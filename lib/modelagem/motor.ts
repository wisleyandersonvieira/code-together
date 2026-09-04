/**
 * Motor de modelagem financeira de incorporação.
 *
 * Determinístico e auditável: mesmos inputs → mesmo output, sem exceção por
 * input inconsistente (o que não fecha vira conferência, não erro).
 *
 * ── Estrutura de passes ──────────────────────────────────────────────────────
 * Três grandezas só são conhecidas depois que o loop mensal termina, e todas as
 * três realimentam o próprio loop:
 *
 *   1. o fee de estruturação depende do compromisso da linha — e, só quando não
 *      há teto contratado nenhum, do PICO do saldo devedor (ver
 *      `baseFeeEstruturacao`);
 *   2. nos modos cash_demand e equity_first_demanda o saque depende do caixa,
 *      que depende do custo financeiro, que depende do saque;
 *   3. a distribuição automática depende do equity total, e uma distribuição
 *      lançada antes do fim muda o caixa de abertura dos meses seguintes, que
 *      muda o equity.
 *
 * Por isso o loop roda dentro de um ponto fixo: cada passada usa as estimativas
 * da passada anterior e para quando nada mais se move além de TOL_CONVERGENCIA.
 * No modo equity_first sem capitalização isso converge em 3 passadas.
 */
import type {
  Agregados,
  Apuracao,
  CategoriaCusto,
  ChaveOverride,
  ConfigLocacao,
  ConvencaoJuros,
  Conferencia,
  CustoAdicional,
  Cronograma,
  DetalheCusto,
  FacilidadeMes,
  FaseCronograma,
  Financiamento,
  Indicadores,
  MesFluxo,
  ModelInput,
  ModelOutput,
  Override,
  RateioSocio,
  RegraRateioCapital,
  ResultadoUnidade,
  TipoModelagem,
  Unidade,
} from './tipos';
import { CATEGORIAS_CUSTO, chaveFacilidade } from './tipos';
import { montarConferencias } from './conferencias';
import { anualizar, diasDoMes, indiceMes, razao, somarMeses, tirMensal, xirr } from './indicadores';

const MAX_ITERACOES = 50;
const TOL_CONVERGENCIA = 0.01;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const chave = (mes: number, linha: ChaveOverride) => `${mes}:${linha}`;

/**
 * As facilidades de crédito do input, na ordem de precedência.
 *
 * Aceita as DUAS formas de entrada e a razão está no comentário de
 * `ModelInput.financiamento`: `financiamentos` é o campo canônico desde a
 * migration 1764200000, e o singular continua aceito porque é sobre ele que o
 * teste de não-regressão inteiro está escrito.
 *
 * `financiamentos` VENCE quando os dois vêm preenchidos — input inconsistente
 * vira conferência (`financiamento_duplicado`), nunca exceção e nunca escolha
 * silenciosa.
 *
 * Lista vazia é um projeto SEM DÍVIDA, e é um input legítimo: o motor calcula
 * normalmente, com saque, juros e fee zerados o projeto inteiro.
 *
 * A ordenação é por `ordem` e, no empate, pela posição de entrada — estável, e a
 * mesma do SELECT e do mapeador. Ordenar aqui também é o que garante que a
 * posição 1-based das chaves de override (`draw:1`) signifique a mesma
 * facilidade venha o input de onde vier.
 */
export function normalizarFacilidades(input: ModelInput): Financiamento[] {
  const lista =
    input.financiamentos && input.financiamentos.length > 0
      ? input.financiamentos
      : input.financiamento
        ? [input.financiamento]
        : [];
  return lista
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.ordem ?? a.i) - (b.f.ordem ?? b.i) || a.i - b.i)
    .map((x) => x.f);
}

/**
 * A facilidade PRINCIPAL de um input: a primeira ATIVA, na ordem de precedência.
 *
 * Existe para a interface e as exportações, que em vários pontos precisam de um
 * contrato para ler — o modo de saque, o colchão, a janela, a flag de linha
 * rotativa. Antes da migration 1764200000 essas leituras iam direto em
 * `input.financiamento`; com 1:N, ir direto ali devolveria `undefined` para toda
 * modelagem carregada do banco, e a tela quebraria em tempo de execução.
 *
 * Devolve `null` quando não há facilidade ativa nenhuma — um projeto sem dívida é
 * input legítimo, e quem chama decide o que mostrar. NÃO devolve um objeto
 * neutro: um contrato falso com taxa zero e janela do mês 1 ao 1 seria lido como
 * um contrato de verdade, e a tela mostraria premissas que ninguém declarou.
 */
export function facilidadePrincipal(input: ModelInput): Financiamento | null {
  return normalizarFacilidades(input).find((f) => f.ativo !== false) ?? null;
}

/**
 * Índices das facilidades que participam de um CICLO de refinanciamento.
 *
 * A → B → A é a forma óbvia; A → A, uma facilidade que refinancia a si mesma, é
 * a forma que passa despercebida e é igualmente destrutiva — o saque quitaria o
 * próprio saldo que acabou de criar, num laço sem fim dentro do mesmo mês.
 *
 * A detecção acontece ANTES do loop mensal e sobre o grafo completo, não durante
 * a travessia: fosse durante, qual das duas facilidades do par sobraria
 * dependeria da ordem de visita, e o resultado deixaria de ser determinístico.
 *
 * Cada nó tem no MÁXIMO uma aresta de saída (`refinanciaIndex` é um só), então o
 * grafo é um funcional: basta caminhar de cada nó até repetir alguém. Os que
 * participam do ciclo valem `null` — param de refinanciar — e
 * `refinanciamento_circular` acende vermelho.
 */
export function ciclosDeRefinanciamento(facilidades: Financiamento[]): Set<number> {
  const emCiclo = new Set<number>();
  const destino = facilidades.map((f) => {
    const alvo = f.refinanciaIndex;
    return alvo != null && Number.isInteger(alvo) && alvo >= 0 && alvo < facilidades.length
      ? alvo
      : null;
  });

  for (let inicio = 0; inicio < facilidades.length; inicio++) {
    const visitados = new Map<number, number>();
    let atual: number | null = inicio;
    let passo = 0;
    while (atual != null && !visitados.has(atual)) {
      visitados.set(atual, passo++);
      atual = destino[atual];
    }
    // Fechou num nó já visitado NESTA caminhada: tudo dali para a frente é ciclo.
    // Um nó visitado antes do fecho é só a "cauda" que leva até ele, e não está
    // em ciclo nenhum.
    if (atual != null) {
      const entrada = visitados.get(atual)!;
      for (const [no, ordem] of visitados) if (ordem >= entrada) emCiclo.add(no);
    }
  }
  return emCiclo;
}

/**
 * Denominadores das tipologias usados pelas bases de cálculo de custo.
 *
 * Todo campo da tipologia é POR UNIDADE, então a área entra multiplicada pela
 * quantidade — a mesma regra de `terrenosTotal`, `obraTotal` e `vgv`.
 */
export interface BasesDeCalculo {
  /** Σ quantidade das tipologias: quantas unidades o projeto tem de fato. */
  unidades: number;
  /** Σ (areaSf × quantidade). */
  areaSf: number;
}

const quantidadeDe = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));

/** Puro: mesmas tipologias, mesmos denominadores. */
export function basesDeCalculo(unidades: Unidade[]): BasesDeCalculo {
  let n = 0;
  let area = 0;
  for (const u of unidades ?? []) {
    const q = quantidadeDe(u);
    n += q;
    area += (u.areaSf || 0) * q;
  }
  return { unidades: n, areaSf: area };
}

/**
 * Custo direto das tipologias, por categoria do orçamento.
 *
 * Só existem estas duas porque só estas duas categorias têm contrapartida em
 * `modelagem_unidades`: 'terreno' ↔ custo_terreno e 'vertical' ↔ custo_obra.
 * Sitework, amenidades, offsite, soft e as demais não têm coluna na tipologia, e
 * por isso a base de referência delas é apenas a soma dos custos adicionais.
 */
export interface CustosDiretos {
  /** Σ (custoTerreno × quantidade). */
  terreno: number;
  /** Σ (custoObra × quantidade). */
  vertical: number;
}

/**
 * Base de referência de cada categoria — o denominador de um custo percentual.
 *
 * NÃO é o mesmo que `Agregados.custosPorCategoria`: aquele é só a soma dos
 * custos adicionais da categoria (e é o que a tela e a planilha mostram como
 * subtotal do orçamento), enquanto este soma também o custo direto das
 * tipologias. Somar o direto no agregado faria terrenosTotal e obraTotal
 * entrarem duas vezes em quem lê os dois campos.
 */
export type ReferenciasCategoria = Record<CategoriaCusto, number>;

export interface ResolucaoCustos {
  /** Valor efetivo de cada custo, alinhado com o array de entrada. */
  valores: number[];
  /**
   * Índices dos custos percentuais que participam de um ciclo de referência.
   * Valem ZERO e acendem `custo_referencia_circular` em vermelho.
   */
  circulares: number[];
  /** Base de cada categoria, para a tela mostrar "5% de $X (Categoria)". */
  referencias: ReferenciasCategoria;
}

const categoriaDe = (c: CustoAdicional): CategoriaCusto =>
  CATEGORIAS_CUSTO.includes(c.categoria) ? c.categoria : 'outros';

/** Referência normalizada; `null` quando ausente ou fora da lista. */
const referenciaDe = (c: CustoAdicional): CategoriaCusto | null =>
  c.grupoReferencia != null && CATEGORIAS_CUSTO.includes(c.grupoReferencia)
    ? c.grupoReferencia
    : null;

/**
 * Valor efetivo de um custo adicional — o número que de fato entra no fluxo.
 *
 * Puro e total: nunca lança. Base 'total', ausente ou desconhecida devolve
 * `custo.valor`, que é exatamente o que o motor lia antes da migration 1761300000
 * — é essa cláusula que garante que nenhuma modelagem já salva mude de resultado.
 *
 * Denominador zero devolve zero, e a conferência `custo_base_zerada` acende âmbar
 * para que o custo sumido não passe despercebido. Zerar em silêncio seria o pior
 * dos mundos, mas lançar exceção violaria a invariante do módulo: input
 * inconsistente vira conferência, nunca erro.
 *
 * `pct_de_grupo` depende das OUTRAS linhas do orçamento, então precisa das bases
 * de referência já resolvidas. Sem elas o resultado é 0 — quem calcula um
 * orçamento inteiro chama `resolverCustos`, que monta as referências, poda os
 * ciclos e chama esta função na ordem certa.
 */
export function valorEfetivoCusto(
  custo: CustoAdicional,
  bases: BasesDeCalculo,
  referencias?: ReferenciasCategoria,
): number {
  switch (custo.baseCalculo) {
    case 'por_unidade':
      return (custo.valorUnitario || 0) * bases.unidades;
    case 'por_sf':
      return (custo.valorUnitario || 0) * bases.areaSf;
    case 'pct_de_grupo': {
      const ref = referenciaDe(custo);
      if (ref == null || !referencias) return 0;
      return (custo.percentual || 0) * referencias[ref];
    }
    default:
      return custo.valor || 0;
  }
}

/**
 * Resolve o orçamento inteiro: valor efetivo de cada linha e base de cada grupo.
 *
 * Existe porque `pct_de_grupo` quebra a independência entre as linhas — a
 * contingência de 5% dos hard costs só é conhecida depois que os hard costs
 * estão. As demais bases não dependem de nada e são resolvidas de saída.
 *
 * ── Ciclos ───────────────────────────────────────────────────────────────────
 * Um item percentual na categoria A que referencia B cria a aresta A → B. Há
 * ciclo quando B alcança A de volta — inclusive o caso trivial B = A, um item
 * que incide sobre a própria categoria.
 *
 * A detecção acontece ANTES da resolução, sobre o grafo completo das 9
 * categorias, e não durante uma travessia: fosse durante, qual dos dois itens de
 * um par mútuo seria zerado dependeria de por onde a travessia começasse, e o
 * motor deixaria de ser determinístico. Aqui os DOIS são zerados, sempre, e a
 * conferência `custo_referencia_circular` nomeia cada um.
 *
 * Podados os itens em ciclo, o que sobra é acíclico e resolve por memoização.
 */
export function resolverCustos(
  custos: CustoAdicional[],
  bases: BasesDeCalculo,
  diretos: CustosDiretos,
): ResolucaoCustos {
  const lista = custos ?? [];
  const cats = lista.map(categoriaDe);

  // 1. Tudo que não depende de ninguém. Os percentuais ficam em 0 por enquanto.
  const valores = lista.map((c) =>
    c.baseCalculo === 'pct_de_grupo' ? 0 : valorEfetivoCusto(c, bases),
  );

  // Contribuição fixa de cada categoria: o custo direto das tipologias.
  const direto = Object.fromEntries(CATEGORIAS_CUSTO.map((c) => [c, 0])) as ReferenciasCategoria;
  direto.terreno = diretos.terreno;
  direto.vertical = diretos.vertical;

  const indicesPct = lista
    .map((c, i) => (c.baseCalculo === 'pct_de_grupo' ? i : -1))
    .filter((i) => i >= 0);

  // 2. Alcance entre categorias, por fecho transitivo sobre as 9 chaves.
  const alcanca = new Map<CategoriaCusto, Set<CategoriaCusto>>(
    CATEGORIAS_CUSTO.map((c) => [c, new Set<CategoriaCusto>()]),
  );
  for (const i of indicesPct) {
    const ref = referenciaDe(lista[i]);
    if (ref != null) alcanca.get(cats[i])!.add(ref);
  }
  // Warshall: 9 categorias, então o cubo é irrelevante e o código fica óbvio.
  for (const k of CATEGORIAS_CUSTO) {
    for (const a of CATEGORIAS_CUSTO) {
      if (!alcanca.get(a)!.has(k)) continue;
      for (const b of alcanca.get(k)!) alcanca.get(a)!.add(b);
    }
  }

  // 3. Item em ciclo: a referência dele alcança a própria categoria dele.
  const circulares = indicesPct.filter((i) => {
    const ref = referenciaDe(lista[i]);
    if (ref == null) return false; // sem referência é outro problema, não ciclo
    return ref === cats[i] || alcanca.get(ref)!.has(cats[i]);
  });
  const emCiclo = new Set(circulares);

  // 4. Resolução do que sobrou — grafo acíclico, memoização por categoria.
  //
  // `referencias` é preenchido à medida que cada categoria fecha, e é o mesmo
  // objeto entregue a `valorEfetivoCusto`: a referência de um item é sempre
  // resolvida na linha anterior à leitura, então nunca se lê base pela metade.
  const referencias = Object.fromEntries(
    CATEGORIAS_CUSTO.map((c) => [c, 0]),
  ) as ReferenciasCategoria;
  const resolvidas = new Set<CategoriaCusto>();
  const emCalculo = new Set<CategoriaCusto>();

  const somaCategoria = (cat: CategoriaCusto): number => {
    if (resolvidas.has(cat)) return referencias[cat];
    // Guarda de segurança. Os ciclos já foram podados no passo 3, então isto não
    // deveria disparar nunca; se disparar, devolve 0 em vez de recursão infinita.
    // O motor não pode travar por input inconsistente.
    if (emCalculo.has(cat)) return 0;
    emCalculo.add(cat);
    let total = direto[cat];
    for (let i = 0; i < lista.length; i++) {
      if (cats[i] !== cat) continue;
      const c = lista[i];
      if (c.baseCalculo === 'pct_de_grupo' && !emCiclo.has(i)) {
        const ref = referenciaDe(c);
        if (ref != null) somaCategoria(ref);
        valores[i] = valorEfetivoCusto(c, bases, referencias);
      }
      total += valores[i];
    }
    emCalculo.delete(cat);
    referencias[cat] = total;
    resolvidas.add(cat);
    return total;
  };

  for (const cat of CATEGORIAS_CUSTO) somaCategoria(cat);

  return { valores, circulares, referencias };
}

/** Uma categoria do orçamento aberta no tempo, com as linhas que a compõem. */
export interface GrupoCustoCategoria {
  categoria: CategoriaCusto;
  /** Σ dos `porMes` dos itens, alinhado com `meses` (índice 0 = mês 1). */
  porMes: number[];
  /** Σ dos `total` dos itens. */
  total: number;
  /** Na ordem de `input.custosAdicionais`, inclusive os que não lançaram nada. */
  itens: DetalheCusto[];
}

/**
 * Agrupa o detalhamento por categoria do orçamento.
 *
 * Pura, e a ÚNICA implementação do agrupamento: a tela, o PDF e a planilha
 * chamam esta função em vez de cada uma somar do seu jeito. Por isso o
 * `ModelOutput` não ganhou um segundo campo agregado por categoria — agrupar é
 * leitura, e a fonte continua sendo `detalhamentoCustos`. Mesma postura de
 * `unidadesVendidasPorMes`, que existe como array solto sem virar segundo cálculo.
 *
 * Devolve um grupo por categoria QUE TENHA ITEM, na ordem de `CATEGORIAS_CUSTO`,
 * e nunca poda item nenhum: um custo que não lançou nada continua dentro do seu
 * grupo, porque ele é informação (a conferência `custo_gatilho_nao_lancado` já
 * trata dele) e esconder aqui tiraria de quem lê a chance de mostrá-lo. Quem
 * decide o que exibir é a tela.
 *
 * `prazoTotal` fixa o comprimento das séries: um `porMes` mais curto (custo
 * recém-criado, output de outra versão) é preenchido com zero em vez de deixar
 * `undefined` contaminar a soma com NaN.
 */
export function agruparCustosPorCategoria(
  detalhe: DetalheCusto[],
  prazoTotal: number,
): GrupoCustoCategoria[] {
  const n = Math.max(0, Math.trunc(prazoTotal) || 0);
  const porCategoria = new Map<CategoriaCusto, GrupoCustoCategoria>();
  for (const d of detalhe ?? []) {
    const cat = CATEGORIAS_CUSTO.includes(d.categoria) ? d.categoria : 'outros';
    let grupo = porCategoria.get(cat);
    if (!grupo) {
      grupo = { categoria: cat, porMes: new Array<number>(n).fill(0), total: 0, itens: [] };
      porCategoria.set(cat, grupo);
    }
    for (let m = 0; m < n; m++) grupo.porMes[m] += d.porMes[m] || 0;
    grupo.total += d.total || 0;
    grupo.itens.push(d);
  }
  return CATEGORIAS_CUSTO.map((c) => porCategoria.get(c)).filter(
    (g): g is GrupoCustoCategoria => g != null,
  );
}

/**
 * Fator de juros de UM mês. Puro: recebe a data, não lê relógio.
 *
 * 'mensal_12' e '30_360' devolvem o MESMO número — 30/360 é 1/12 exato. Os dois
 * existem porque o contrato declara uma convenção ou a outra, e o usuário precisa
 * poder registrar a dele; a diferença de verdade está nas bases 'actual', que
 * contam os dias reais do mês (28, 29, 30 ou 31).
 *
 * Sobre base 360, um ano de 365 dias cobra 365/360 = 1,39% a mais de juros que a
 * conta mensal — em dezenas de milhões de saque, é dinheiro que o banco cobra e o
 * modelo precisa prever.
 */
export function fatorJurosDoMes(
  convencao: ConvencaoJuros,
  taxaAnual: number,
  dataDoMes: string,
): number {
  const taxa = taxaAnual || 0;
  switch (convencao) {
    case '30_360':
      return (taxa * 30) / 360;
    case 'actual_360':
      return (taxa * diasDoMes(dataDoMes)) / 360;
    case 'actual_365':
      return (taxa * diasDoMes(dataDoMes)) / 365;
    default:
      // 'mensal_12' — o default do banco e a conta anterior à migration 1762400000.
      return taxa / 12;
  }
}

interface EstadoPonto {
  /**
   * Fee de estruturação de CADA facilidade, alinhado com a lista completa de
   * facilidades (inclusive as inativas, que valem zero).
   *
   * É por facilidade, e não um total do projeto, porque cada uma incide sobre o
   * próprio valor contratado e é lançada no próprio mês de fee — duas
   * facilidades podem ter `feeTiming` diferentes e cobrar em meses diferentes.
   */
  feePorFacilidade: number[];
  /** Custo financeiro de caixa por mês, indexado de 1 a prazoTotal. */
  custoFinPorMes: number[];
  distribuicaoAutomatica: number;
}

/**
 * O que uma passada do loop mensal devolve.
 *
 * O corte pelo teto é acumulado DENTRO do passe, e não recomputado depois a
 * partir de `meses`: a conferência tem de cobrar exatamente o número que o
 * cálculo usou — a mesma razão de `bases` e `resolucao` chegarem prontos às
 * conferências.
 */
interface ResultadoPasse {
  meses: MesFluxo[];
  /** Meses em que a demanda existia e a capacidade foi o limite do saque. */
  mesesNoTeto: number;
  /** Σ (demanda − saque) nesses meses: o que ficou sem cobertura. */
  descobertoPorTeto: number;
  /** Σ do release que o teto do saldo de abertura cortou no projeto inteiro. */
  releaseCortadoTotal: number;
  /**
   * Refinanciamento que o TETO da facilidade que refinancia não cobriu, por
   * facilidade refinanciada: quanto de saldo devedor ficou de pé porque a nova
   * dívida não deu para quitar a velha.
   *
   * Vem do passe pelo mesmo motivo dos três acima: é o número que a amortização
   * de fato usou, e recomputá-lo na conferência abriria espaço para as duas
   * contas divergirem. Alimenta `refinanciamento_insuficiente`.
   */
  refinanciamentoDescoberto: { refinanciadora: number; refinanciada: number; falta: number }[];
}

export function calcular(input: ModelInput): ModelOutput {
  // ─── O SWITCH (migration 1764000000) ───────────────────────────────────────
  // Ausente = 'venda', que é o default do banco e o comportamento anterior a
  // esta versão. TODO caminho de locação abaixo está atrás desta flag, e é por
  // isso que nenhuma modelagem já gravada pode mudar de resultado: para ela,
  // `ehLocacao` é constante false e os blocos novos são inalcançáveis.
  const tipoModelagem: TipoModelagem = input.tipoModelagem ?? 'venda';
  const ehLocacao = tipoModelagem === 'locacao';

  const rec = input.receita;
  const unidades = input.unidades ?? [];
  const custosAdicionais = input.custosAdicionais ?? [];
  const socios = input.socios ?? [];

  // ─── As facilidades de crédito (migration 1764200000) ──────────────────────
  // A lista COMPLETA, inclusive as inativas: a posição aqui é o endereço das
  // chaves de override (`draw:2` é a segunda desta lista), e filtrar as
  // inativas antes remapearia os overrides das que sobraram para outra
  // facilidade — em silêncio, e com número diferente.
  const facilidades = normalizarFacilidades(input);
  const facilidadeAtiva = facilidades.map((f) => f.ativo !== false);
  const emCicloRefin = ciclosDeRefinanciamento(facilidades);

  /**
   * Padrão neutro da locação: tudo zerado, ocupação estabilizada em 100%.
   *
   * Lido mesmo no modo venda porque as expressões abaixo o referenciam, mas ali
   * ele nunca chega a multiplicar nada — a receita de aluguel e o OPEX são
   * zerados na origem.
   */
  const loc: ConfigLocacao = input.locacao ?? {
    taxaReembolsoPct: 0,
    perdaCreditoPct: 0,
    capRateSaida: 0,
    custoVendaPct: 0,
    noiReferencia: 'estabilizado',
    ocupacaoEstabilizadaPct: 1,
  };

  // ─── Cronograma ────────────────────────────────────────────────────────────
  const prazoTotal = Math.max(
    0,
    Math.trunc(input.mesesAprovacao) +
      Math.trunc(input.mesesConstrucao) +
      Math.trunc(input.mesesPosObra),
  );
  const mesInicioObra = Math.trunc(input.mesesAprovacao) + 1;
  const mesFimObra = Math.trunc(input.mesesAprovacao) + Math.trunc(input.mesesConstrucao);
  const mesSaida = rec.mesSaida ?? prazoTotal;
  const horizonteMaximo = input.horizonteMaximo ?? 60;

  // ─── Fases ─────────────────────────────────────────────────────────────────
  // Índices DERIVADOS das datas, sem limite nenhum: é o que a interface mostra e
  // o que as conferências examinam. Fase invertida sai com mesFim < mesInicio e
  // fase que estoura o prazo sai com mesFim > prazoTotal — os dois casos ficam
  // visíveis em vez de serem corrigidos em silêncio. O clamp para o cálculo vem
  // depois, em `janelasFase`.
  const fasesInput = input.fases ?? [];
  const fasesCronograma: FaseCronograma[] = fasesInput.map((f) => ({
    nome: f.nome,
    mesInicio: indiceMes(input.dataInicio, f.dataInicio),
    mesFim: indiceMes(input.dataInicio, f.dataFim),
    dataInicio: f.dataInicio,
    dataFim: f.dataFim,
  }));

  const cronograma: Cronograma = {
    prazoTotal,
    mesInicioObra,
    mesFimObra,
    mesSaida,
    horizonteMaximo,
    dataInicio: input.dataInicio,
    dataInicioObra: somarMeses(input.dataInicio, mesInicioObra - 1),
    dataFimObra: somarMeses(input.dataInicio, Math.max(mesFimObra, 1) - 1),
    dataSaida: somarMeses(input.dataInicio, Math.max(mesSaida, 1) - 1),
    fases: fasesCronograma,
  };

  // Janela de cálculo de cada fase: limitada a 1..prazoTotal.
  //
  // Fase que estoura o prazo NÃO perde custo: a janela é comprimida até o último
  // mês e a conferência `fases_dentro_prazo` acende vermelho. Custo lançado pelo
  // usuário nunca some em silêncio.
  const ultimoMes = Math.max(prazoTotal, 1);
  const janelas = fasesCronograma.map((f) => {
    const inicio = clamp(Math.trunc(f.mesInicio), 1, ultimoMes);
    const fim = clamp(Math.trunc(Math.max(f.mesFim, f.mesInicio)), inicio, ultimoMes);
    return { inicio, fim, duracao: fim - inicio + 1 };
  });
  // `usaFases` sem nenhuma fase cadastrada cairia num projeto sem obra nenhuma.
  // Nesse caso o motor segue pelo caminho de frente única e a conferência
  // `fases_sem_linha` acende âmbar.
  const fasesAtivas = !!input.usaFases && janelas.length > 0 && prazoTotal >= 1;
  const terrenoPorFase = !!input.terrenoPorFase;

  // ─── Agregados das tipologias ──────────────────────────────────────────────
  // Cada linha de `unidades` é uma TIPOLOGIA e seus valores são POR UNIDADE, então
  // todo agregado multiplica por quantidade. Com quantidade = 1 (o default da
  // migration 1761000000) a multiplicação é a identidade e nada muda.
  const qtd = quantidadeDe;
  const terrenosTotal = soma(unidades.map((u) => (u.custoTerreno || 0) * qtd(u)));
  const obraTotal = soma(unidades.map((u) => (u.custoObra || 0) * qtd(u)));
  const vgv = soma(unidades.map((u) => (u.precoVenda || 0) * qtd(u)));
  const taxAnoTotal = soma(unidades.map((u) => (u.propertyTaxAno || 0) * qtd(u)));
  const unidadesTotal = soma(unidades.map(qtd));
  const propertyTaxTotal = (taxAnoTotal / 12) * prazoTotal;

  // ─── O ativo locável (migration 1764050000) ────────────────────────────────
  // `ablSf` é a mesma conta de `areaTotalSf` — Σ (areaSf × quantidade) — exposta
  // com o nome que a pro forma de locação usa. Sai da MESMA expressão para as
  // duas leituras não terem como divergir.
  //
  // `receitaBrutaAnual100` é o TETO da receita, não a receita: o que entra em
  // cada mês é ela dividida por 12, multiplicada pela ocupação daquele mês e
  // líquida de perda de crédito.
  //
  // As duas são calculadas nos dois modos, e no modo venda `aluguelSfAno` é 0
  // em toda tipologia — logo `receitaBrutaAnual100` é 0 e nada muda.
  const receitaBrutaAnual100 = soma(
    unidades.map((u) => (u.areaSf || 0) * (u.aluguelSfAno || 0) * qtd(u)),
  );

  // ─── Custo por fase ────────────────────────────────────────────────────────
  // A obra e o terreno de cada fase saem da ALOCAÇÃO de tipologias por fase:
  // Σ (valor unitário da tipologia × quantidade alocada naquela fase).
  //
  // O que não estiver alocado não é lançado em mês nenhum. Isso é deliberado: o
  // motor não inventa distribuição, usa o que o usuário declarou. Alocação que
  // não fecha com a quantidade da tipologia acende `alocacao_fases` em vermelho e
  // BLOQUEIA o salvamento — mas o cálculo segue e devolve resultado, como todas
  // as outras conferências.
  const custoPorFase = janelas.map(() => ({ obra: 0, terreno: 0 }));
  for (const a of input.alocacoes ?? []) {
    const u = unidades[a.unidadeIndex];
    const alvo = custoPorFase[a.faseIndex];
    if (!u || !alvo) continue;
    const q = Math.max(0, Math.trunc(a.quantidade || 0));
    alvo.obra += (u.custoObra || 0) * q;
    alvo.terreno += (u.custoTerreno || 0) * q;
  }
  const janelasFase = janelas.map((j, i) => ({ ...j, ...custoPorFase[i] }));

  // ─── Aporte base ───────────────────────────────────────────────────────────
  // O aporte base deixou de ser atributo da unidade e passou a ser premissa do
  // projeto (tabela modelagem_aportes). A derivação é a mesma de antes, sobre a
  // mesma grandeza: a migration semeia aporte_base_total com a soma que este
  // ponto calculava. max(0, …): se o aporte base não cobre nem o terreno, o valor
  // tem de ficar em zero — senão a dívida do modo equity_first começa maior que a
  // obra acumulada.
  const aporteBaseTotal = input.aportes?.aporteBaseTotal ?? 0;
  const equityDisponivelObra = Math.max(0, aporteBaseTotal - terrenosTotal);

  // ─── Plano de aportes ──────────────────────────────────────────────────────
  // Duas parcelas no mesmo mês somam em vez de uma sobrescrever a outra. O banco
  // tem UNIQUE (modelagem_id, mes) e a interface bloqueia o mês repetido, mas o
  // motor é chamado também com input de teste e de sensibilidade: somar é a única
  // leitura que não perde dinheiro do usuário.
  const modoAporte = input.aportes?.modoAporte ?? 'demanda';
  const parcelas = input.aportes?.parcelas ?? [];
  const parcelaPorMes = new Map<number, number>();
  for (const p of parcelas) {
    const mes = Math.trunc(p.mes);
    if (!Number.isFinite(mes) || mes < 1) continue;
    parcelaPorMes.set(mes, (parcelaPorMes.get(mes) ?? 0) + (p.valor || 0));
  }
  // Σ de TODAS as parcelas, inclusive as que caem além do prazo: é o que o
  // usuário planejou. As que não cabem no cronograma não são lançadas e a
  // conferência `aporte_parcela_fora_prazo` acusa.
  const aportePlanejadoTotal = soma(parcelas.map((p) => p.valor || 0));

  const parcelasAcumuladas = new Array<number>(prazoTotal + 1).fill(0);
  for (let m = 1; m <= prazoTotal; m++) {
    parcelasAcumuladas[m] = parcelasAcumuladas[m - 1] + (parcelaPorMes.get(m) ?? 0);
  }

  // ─── Capital por sócio (migration 1763100000) ──────────────────────────────
  // 'participacao' é o default e o comportamento de sempre; os outros dois
  // caminhos são inalcançáveis para toda modelagem já gravada.
  const regraCapital: RegraRateioCapital = input.aportes?.regraRateioCapital ?? 'participacao';

  /**
   * O que cada sócio aporta em cada mês, e o total do mês.
   *
   * A guarda de mês é a mesma de `lancar` nos custos: aporte fora de
   * 1..prazoTotal NÃO é lançado, fica guardado no banco e vira conferência. Sem
   * ela, `mes = 5.5` criaria uma propriedade solta no array — invisível no fluxo,
   * mas contada como aportada.
   *
   * Dois aportes do mesmo sócio no mesmo mês SOMAM: é a mesma leitura dos
   * takedowns e das parcelas de custo, e a única que não perde dinheiro do usuário.
   */
  const aporteDoSocioPorMes = socios.map(() => new Map<number, number>());
  const aporteSociosPorMes = new Map<number, number>();
  socios.forEach((s, i) => {
    for (const a of s.aportes ?? []) {
      const mes = Math.trunc(a.mes);
      if (!Number.isInteger(a.mes) || mes < 1 || mes > prazoTotal) continue;
      const v = a.valor || 0;
      aporteDoSocioPorMes[i].set(mes, (aporteDoSocioPorMes[i].get(mes) ?? 0) + v);
      aporteSociosPorMes.set(mes, (aporteSociosPorMes.get(mes) ?? 0) + v);
    }
  });

  const aportesSociosAcumulados = new Array<number>(prazoTotal + 1).fill(0);
  for (let m = 1; m <= prazoTotal; m++) {
    aportesSociosAcumulados[m] =
      aportesSociosAcumulados[m - 1] + (aporteSociosPorMes.get(m) ?? 0);
  }

  /**
   * Equity disponível para a obra ATÉ o mês `m`.
   *
   * No modo 'plano' é uma curva: o capital que efetivamente já entrou, descontado
   * o terreno. No modo 'demanda' é o escalar de sempre, constante em todos os
   * meses — por isso o comportamento anterior é reproduzido exatamente.
   *
   * max(0, …) nos dois: se o equity não cobre nem o terreno, o valor tem de ficar
   * em zero, senão a dívida do modo equity_first começaria maior que a obra
   * acumulada.
   */
  const equityDisponivelObraAte = (m: number) =>
    // Com cronograma por sócio a curva sai da soma dos aportes declarados — é a
    // mesma lógica do modo 'plano', só muda a fonte. E vem ANTES dele porque em
    // 'cronograma_socio' são os sócios que definem o aporte do mês.
    regraCapital === 'cronograma_socio'
      ? Math.max(0, (aportesSociosAcumulados[m] ?? 0) - terrenosTotal)
      : modoAporte === 'plano'
        ? Math.max(0, (parcelasAcumuladas[m] ?? 0) - terrenosTotal)
        : equityDisponivelObra;

  // ─── Valor efetivo de cada custo adicional ─────────────────────────────────
  // Resolvido UMA vez, aqui, e reusado tanto nos subtotais por categoria quanto
  // no loop mensal: os dois têm de enxergar exatamente o mesmo número, senão o
  // subtotal do orçamento deixaria de bater com o que é lançado no fluxo.
  const bases = basesDeCalculo(unidades);
  const resolucao = resolverCustos(custosAdicionais, bases, {
    terreno: terrenosTotal,
    vertical: obraTotal,
  });
  const efetivoPorCusto = resolucao.valores;

  // ─── Subtotais do orçamento por categoria ──────────────────────────────────
  // Agregado de SAÍDA, não regra de lançamento: nada aqui toca o loop mensal, e
  // trocar a categoria de uma linha não move um único mês do fluxo. É o que
  // garante que uma modelagem existente — toda ela em 'outros', o default da
  // migration 1761200000 — produza exatamente o mesmo ModelOutput de antes.
  //
  // Cada linha é somada UMA vez, no seu próprio bucket. `grupoPaiId` é hierarquia
  // visual e não participa da soma: se o pai também fosse somado, um custo
  // aninhado entraria em duplicidade.
  //
  // Categoria desconhecida cai em 'outros' em vez de criar chave nova ou estourar
  // — input inconsistente vira resultado, nunca exceção.
  const custosPorCategoria = Object.fromEntries(
    CATEGORIAS_CUSTO.map((c) => [c, 0]),
  ) as Record<CategoriaCusto, number>;
  custosAdicionais.forEach((c, i) => {
    const cat: CategoriaCusto = CATEGORIAS_CUSTO.includes(c.categoria) ? c.categoria : 'outros';
    custosPorCategoria[cat] += efetivoPorCusto[i];
  });

  const agregados: Agregados = {
    terrenosTotal,
    obraTotal,
    unidadesTotal,
    vgv,
    taxAnoTotal,
    propertyTaxTotal,
    equityDisponivelObra,
    aportePlanejadoTotal,
    custosPorCategoria,
    areaTotalSf: bases.areaSf,
    // Mesma conta de `areaTotalSf`, nome da locação. Ver o comentário acima.
    ablSf: bases.areaSf,
    receitaBrutaAnual100,
  };

  // ─── Overrides ─────────────────────────────────────────────────────────────
  // Overrides fora do prazo NÃO são apagados: ficam inativos, acendem conferência
  // e voltam a valer se o prazo aumentar de novo.
  const ativos = new Map<string, number | null>();
  const orfaos: Override[] = [];
  /**
   * Canonicaliza a chave da linha para o formato POR FACILIDADE.
   *
   * `draw` e `amortization` SEM sufixo são a forma anterior à migration
   * 1764200000, quando só existia uma facilidade, e significam exatamente o que
   * sempre significaram: a facilidade 1. A migration converteu o que estava
   * gravado, mas a leitura tolerante tem de ficar — réplica atrasada, restore de
   * backup e snapshot de cenário antigo ainda trazem a forma velha, e ignorá-la
   * faria o override do usuário DESAPARECER do fluxo em silêncio, que é
   * exatamente o desfecho que este módulo não admite.
   *
   * Canonicalizar na ENTRADA, e não na consulta, é o que garante que
   * `celulasManuais` conte uma célula só quando as duas formas coexistirem —
   * como acontece num banco em que a migration rodou pela metade.
   */
  const canonica = (linha: ChaveOverride): ChaveOverride =>
    linha === 'draw' || linha === 'amortization' ? chaveFacilidade(linha, 1) : linha;
  for (const o of input.overrides ?? []) {
    if (!Number.isInteger(o.mes) || o.mes < 1 || o.mes > prazoTotal) {
      orfaos.push(o);
      continue;
    }
    ativos.set(chave(o.mes, canonica(o.linha)), o.limpar ? null : (o.valor ?? 0));
  }
  const temOverride = (m: number, l: ChaveOverride) => ativos.has(chave(m, l));
  // `null` (célula forçada a vazio) não contribui com nada na aritmética, mas
  // continua distinta de zero para a interface.
  const valorOverride = (m: number, l: ChaveOverride) => ativos.get(chave(m, l)) ?? 0;

  // ─── Linhas de custo e receita (não dependem da iteração) ──────────────────
  const zeros = () => new Array<number>(prazoTotal + 1).fill(0);
  const land = zeros();
  const construction = zeros();
  const propertyTax = zeros();
  const otherCosts = zeros();
  const revenue = zeros();
  // ─── Linhas do modo locação ────────────────────────────────────────────────
  // Zeradas o projeto inteiro no modo venda: os laços que as preenchem estão
  // todos atrás de `ehLocacao`.
  const ocupacaoMes = zeros();
  const rentalRevenue = zeros();
  const opexBruto = zeros();
  const opexReembolso = zeros();
  const opex = zeros();
  const noiMes = zeros();

  const mesesConstrucao = Math.trunc(input.mesesConstrucao);
  /**
   * Fator líquido da venda: 1 − comissão − cartório.
   *
   * NÃO se aplica no modo locação, e a razão é dupla. Primeiro, não há venda de
   * unidade nenhuma para corretar. Segundo — e é o erro que produziria número
   * errado em silêncio —, quem faz o papel dos dois na locação é
   * `custoVendaPct`, que já é a corretagem da venda do ATIVO; aplicar os três
   * contaria comissão duas vezes sobre o mesmo negócio.
   */
  const fatorLiquido = ehLocacao ? 1 : 1 - (rec.comissaoPct || 0) - (rec.custoCartorioPct || 0);

  // ─── Terreno e obra ────────────────────────────────────────────────────────
  // Sem fases — o caminho de toda modelagem anterior a esta versão, e o que
  // continua valendo por default: terreno inteiro no mês 1, obra linear na janela
  // de construção.
  if (!fasesAtivas) {
    for (let m = 1; m <= prazoTotal; m++) {
      land[m] = m === 1 ? terrenosTotal : 0;
      construction[m] =
        mesesConstrucao > 0 && m >= mesInicioObra && m <= mesFimObra ? obraTotal / mesesConstrucao : 0;
    }
  } else {
    // Com fases, a obra de cada fase é distribuída linearmente dentro da janela
    // DELA, não da janela de construção do projeto.
    if (!terrenoPorFase && prazoTotal >= 1) land[1] = terrenosTotal;
    for (const f of janelasFase) {
      for (let m = f.inicio; m <= f.fim; m++) construction[m] += f.obra / f.duracao;
      if (terrenoPorFase) land[f.inicio] += f.terreno;
    }
  }

  for (let m = 1; m <= prazoTotal; m++) {
    // Property tax ainda não conhece fase: continua rateado linearmente pelo
    // prazo inteiro. O próximo passo natural é o property tax por fase,
    // começando no mês de início de cada uma — quem for mexer, mexe aqui.
    //
    // NO MODO LOCAÇÃO A LINHA É ZERO, e isto é o ponto que produziria número
    // errado em silêncio se fosse esquecido: lá o property tax vem de uma LINHA
    // DE OPEX, que entra na base do reembolso NNN. Lançar os dois cobraria o
    // imposto DUAS VEZES — uma aqui, pela coluna da tipologia, outra pelo OPEX.
    //
    // A coluna `propertyTaxAno` da tipologia não é apagada nem zerada: fica
    // guardada e inativa, e `property_tax_duplicado` acende âmbar se estiver
    // preenchida, dizendo que só a linha de OPEX entra na conta.
    propertyTax[m] = ehLocacao ? 0 : taxAnoTotal / 12;
  }

  // ─── Unidades vendidas por mês (gatilho 'por_venda') ───────────────────────
  // Impact fee, water/sewer fee e alvará vencem no FECHAMENTO da unidade, então
  // precisam saber quantas unidades fecham em cada mês.
  //
  // A venda escalonada dentro de uma tipologia (takedown) ainda não existe neste
  // módulo — `modelagem_vendas_unidade` guarda um único mês por tipologia. Logo,
  // a tipologia inteira fecha de uma vez. Quando o takedown chegar, é ESTE mapa
  // que passa a ser montado a partir dele; nada mais abaixo precisa mudar.
  const vendasPorMes = new Map<number, number>();
  // Preço BRUTO das unidades que fecham no mês. Só o release price percentual lê
  // isto; a contagem de unidades acima serve ao gatilho de custo e ao release fixo.
  const valorVendidoPorMes = new Map<number, number>();
  const venderNoMes = (mes: number, n: number, precoUnitario: number) => {
    if (!Number.isInteger(mes) || mes < 1 || mes > prazoTotal || n <= 0) return;
    vendasPorMes.set(mes, (vendasPorMes.get(mes) ?? 0) + n);
    valorVendidoPorMes.set(mes, (valorVendidoPorMes.get(mes) ?? 0) + precoUnitario * n);
  };
  // NO MODO LOCAÇÃO NÃO HÁ VENDA DE UNIDADE NENHUMA: `modoVenda`, os takedowns
  // e a venda por unidade não são usados, e nenhuma unidade "fecha" em mês
  // nenhum. Consequências, todas desejadas: `unidadesVendidas` é zero em todo
  // mês, o release price nunca dispara e o gatilho de custo 'por_venda' não
  // lança nada — e `custo_gatilho_nao_lancado` acusa, como já faz no modo
  // 'manual'. O que vende, uma vez só, é o ATIVO, e isso é a linha `revenue` do
  // mês de saída, montada mais abaixo.
  if (ehLocacao) {
    // Nada a fazer: o mapa fica vazio de propósito.
  } else if (rec.modoVenda === 'single_exit') {
    // Saída única: todas as unidades fecham no mês da venda do projeto. O preço
    // médio é o único disponível aqui — o VGV dividido pelas unidades.
    venderNoMes(mesSaida, unidadesTotal, unidadesTotal > 0 ? vgv / unidadesTotal : 0);
  } else if (rec.modoVenda === 'per_unit') {
    for (const venda of rec.vendasPorUnidade ?? []) {
      const u = unidades[venda.unidadeIndex];
      if (u) venderNoMes(venda.mesVenda, qtd(u), u.precoVenda || 0);
    }
  } else if (rec.modoVenda === 'takedown') {
    // Aqui o takedown deixa de ser hipótese e vira a fonte: cada lote fecha N
    // unidades no seu mês. Lote fora do prazo não é contado (nem lançado) — a
    // conferência `takedown_incompleto` acusa a unidade que sobrou.
    for (const t of rec.takedowns ?? []) {
      const u = unidades[t.unidadeIndex];
      if (!u) continue;
      const preco = (t.precoUnitario || 0) > 0 ? t.precoUnitario : u.precoVenda || 0;
      venderNoMes(t.mes, Math.max(0, Math.trunc(t.quantidade || 0)), preco);
    }
  }
  // 'manual' → o usuário não declarou cronograma de venda nenhum. O motor NÃO
  // inventa um: nada é lançado por venda, e `custo_gatilho_nao_lancado` acende
  // âmbar dizendo quanto ficou de fora. É a mesma postura da alocação por fase.

  // ─── Lançamento dos custos adicionais no tempo ─────────────────────────────
  // Laço por CUSTO, acumulando nos meses — antes era um laço por mês somando os
  // custos. Para um mês fixo, as parcelas continuam entrando na ordem do índice
  // do custo, então a soma em ponto flutuante é bit a bit a mesma de antes; é o
  // que o teste de não-regressão cobra.
  //
  // Duas grandezas independentes, nesta ordem:
  //   o GATILHO decide QUANDO — e, fora de 'cronograma', substitui a distribuição;
  //   a BASE decide QUANTO, e já foi resolvida em `efetivoPorCusto`.
  //
  // `lancadoPorCusto` fecha o circuito: o que o gatilho não conseguiu lançar
  // (mês fora do prazo, nenhuma venda declarada) vira conferência em vez de
  // sumir em silêncio.
  const lancadoPorCusto = new Array<number>(custosAdicionais.length).fill(0);
  // Mesma grandeza de `lancadoPorCusto`, aberta no tempo — e alimentada dentro do
  // MESMO `lancar`, nunca num segundo laço: um laço paralelo divergiria do fluxo
  // na primeira mudança de regra de gatilho, e divergiria em silêncio.
  const porCustoMes = custosAdicionais.map(() => new Array<number>(prazoTotal + 1).fill(0));
  const lancar = (i: number, mes: number, valor: number) => {
    // `Number.isInteger` reproduz exatamente o comportamento anterior: o laço
    // antigo comparava `c.mesAncora === m` contra meses inteiros, então âncora
    // fracionária nunca casava e nada era lançado. Sem esta guarda, `mes = 5.5`
    // criaria uma propriedade solta no array — invisível no fluxo, mas contada
    // como lançada.
    if (!Number.isInteger(mes) || mes < 1 || mes > prazoTotal) return;
    otherCosts[mes] += valor;
    lancadoPorCusto[i] += valor;
    porCustoMes[i][mes] += valor;
  };

  for (let i = 0; i < custosAdicionais.length; i++) {
    const c = custosAdicionais[i];
    const valor = efetivoPorCusto[i];

    if (c.gatilho === 'inicio_obra') {
      lancar(i, mesInicioObra, valor);
    } else if (c.gatilho === 'fim_obra') {
      lancar(i, mesFimObra, valor);
    } else if (c.gatilho === 'mes_fixo') {
      // Parcelamento (migration 1763000000). Duas consequências, e as duas são
      // deliberadas:
      //
      //   1. Com parcelas, `mesAncora` é IGNORADO. O gatilho já substitui a
      //      distribuição; as parcelas substituem a âncora. A âncora continua
      //      gravada e volta a valer se as parcelas forem removidas — nada do que
      //      o usuário digitou é apagado.
      //
      //   2. Com parcelas, quem manda no total lançado são ELAS, não `valor`. Um
      //      custo 'por_unidade' continua tendo o alvo derivado das unidades, e
      //      esse alvo vira REFERÊNCIA da conferência `custo_parcelas_vs_alvo` —
      //      não um teto e não um piso. Corrigir a última parcela para fechar o
      //      alvo seria o motor decidindo por cima do usuário.
      //
      // Lista vazia cai no ramo de sempre: 100% no mês âncora, que é exatamente o
      // comportamento anterior e o de toda linha já gravada.
      const parcelasCusto = c.parcelas ?? [];
      if (parcelasCusto.length > 0) {
        // A guarda de `lancar` continua valendo: parcela fora do prazo não é
        // lançada, fica guardada no banco e vira conferência.
        for (const parcela of parcelasCusto) lancar(i, parcela.mes, parcela.valor || 0);
      } else if (c.mesAncora != null) {
        // Sem mês âncora não há onde lançar. Não é erro: é conferência.
        lancar(i, c.mesAncora, valor);
      }
    } else if (c.gatilho === 'por_venda') {
      // Rateio pro-rata pelas unidades que fecham em cada mês. Com base
      // 'por_unidade' isto é exatamente valorUnitario × unidades vendidas no mês;
      // para as demais bases é o equivalente pro-rata do total.
      //
      // Sem unidade nenhuma o rateio não tem denominador — nada é lançado, e a
      // conferência acusa. Dividir por zero devolveria NaN e contaminaria o fluxo
      // inteiro em silêncio, que é o pior desfecho possível.
      if (unidadesTotal > 0) {
        for (const [mes, n] of vendasPorMes) lancar(i, mes, (valor * n) / unidadesTotal);
      }
    } else {
      // 'cronograma' — o default, e o caminho de toda modelagem anterior à
      // migration 1761500000: quem manda é a distribuição, exatamente como antes.
      if (c.distribuicao === 'linear_construction') {
        if (mesesConstrucao > 0) {
          for (let m = mesInicioObra; m <= mesFimObra; m++) lancar(i, m, valor / mesesConstrucao);
        }
      } else if (c.distribuicao === 'linear_total') {
        if (prazoTotal > 0) {
          for (let m = 1; m <= prazoTotal; m++) lancar(i, m, valor / prazoTotal);
        }
      } else if (c.distribuicao === 'single_month') {
        if (c.mesAncora != null) lancar(i, c.mesAncora, valor);
      }
      // 'manual' → só overrides. Lançar zero aqui é intencional.
    }
  }

  // Detalhamento na ordem de `custosAdicionais` — a mesma ordem que a aba Custos
  // grava, para o índice servir de endereço nos dois lados. `total` reusa
  // `lancadoPorCusto` em vez de somar de novo: os dois números têm de ser o mesmo
  // bit a bit, e a conferência lê justamente esse escalar.
  //
  // `slice(1)` alinha com `meses`: o array interno é indexado pelo mês (1..N) e o
  // exposto pela posição (0 = mês 1), como `unidadesVendidasPorMes`.
  //
  // Montado AQUI, antes do bloco de overrides, e não no fim: o detalhamento é o
  // que o motor lançou, e o override é ajuste sobre isso — misturar os dois faria
  // a soma das filhas deixar de fechar com o pai sem nada dizer.
  const detalhamentoCustos: DetalheCusto[] = custosAdicionais.map((c, i) => ({
    indice: i,
    id: c.id,
    label: c.label,
    // Mesma normalização de `custosPorCategoria`: categoria desconhecida cai em
    // 'outros' em vez de criar um grupo que a tela não sabe rotular.
    categoria: CATEGORIAS_CUSTO.includes(c.categoria) ? c.categoria : 'outros',
    porMes: porCustoMes[i].slice(1),
    total: lancadoPorCusto[i],
  }));

  // ─── A RECEITA BIFURCA AQUI ────────────────────────────────────────────────
  //
  // Venda: a receita é o preço das unidades, lançado conforme o modo de venda —
  // tudo no mês da saída, por tipologia, ou em lotes (takedown).
  //
  // Locação: a receita tem DUAS origens e nenhuma delas é preço de unidade —
  //   o ALUGUEL, mês a mês, na linha `rental_revenue` (montada logo abaixo);
  //   a VENDA DO ATIVO, um único lançamento em `revenue`, no mês de saída,
  //   valendo o NOI de referência dividido pelo cap rate, menos o custo de
  //   venda.
  // `modoVenda`, `vendasPorUnidade` e `takedowns` NÃO são lidos: a linha
  // `revenue` da locação tem exatamente um lançamento, e ele não depende de
  // cronograma de venda nenhum.
  if (ehLocacao) {
    // Preenchida mais abaixo, depois da curva de ocupação e do OPEX: o valor de
    // saída depende do NOI, e o NOI depende dos dois.
  } else if (rec.modoVenda === 'single_exit') {
    if (mesSaida >= 1 && mesSaida <= prazoTotal) revenue[mesSaida] = vgv * fatorLiquido;
  } else if (rec.modoVenda === 'per_unit') {
    for (const venda of rec.vendasPorUnidade ?? []) {
      const u = unidades[venda.unidadeIndex];
      if (!u) continue;
      if (venda.mesVenda >= 1 && venda.mesVenda <= prazoTotal) {
        // A tipologia inteira vende no mesmo mês. Para escalonar dentro de uma
        // tipologia — parte das N unidades num mês, o resto em outro — o modo é
        // 'takedown'; este aqui continua existindo e inalterado.
        revenue[venda.mesVenda] += (u.precoVenda || 0) * qtd(u) * fatorLiquido;
      }
    }
  } else if (rec.modoVenda === 'takedown') {
    // Cada lote lança quantidade × preço efetivo × fatorLiquido no seu mês.
    // Dois lotes no mesmo mês SOMAM em vez de um sobrescrever o outro — é a
    // mesma leitura das parcelas de aporte, e a única que não perde dinheiro do
    // usuário.
    for (const t of rec.takedowns ?? []) {
      const u = unidades[t.unidadeIndex];
      if (!u) continue;
      const n = Math.max(0, Math.trunc(t.quantidade || 0));
      if (n <= 0 || !Number.isInteger(t.mes) || t.mes < 1 || t.mes > prazoTotal) continue;
      // preço 0 = "usar o preço da tipologia", conforme o COMMENT da coluna.
      const preco = (t.precoUnitario || 0) > 0 ? t.precoUnitario : u.precoVenda || 0;
      revenue[t.mes] += preco * n * fatorLiquido;
    }
  }
  // 'manual' → só overrides.

  // ─── Operação: ocupação, aluguel, OPEX e NOI (migration 1764100000) ────────
  //
  // Tudo aqui é DETERMINÍSTICO a partir do input: nada depende do saque, do
  // caixa ou do custo financeiro. Por isso o bloco fica FORA do ponto fixo — a
  // locação não acrescenta nenhuma realimentação nova às três que já existiam.
  const linhasOpex = input.opex ?? [];
  // O OPEX é uma taxa anual por pé quadrado de ABL. Os dois totais anuais saem
  // daqui e são usados em dois lugares — o lançamento mês a mês e o NOI de
  // referência —, sempre os mesmos números.
  const opexBrutoAnual = ehLocacao
    ? soma(linhasOpex.map((l) => (l.valorSfAno || 0) * bases.areaSf))
    : 0;
  const opexBrutoReembolsavelAnual = ehLocacao
    ? soma(
        linhasOpex
          .filter((l) => l.reembolsavel !== false)
          .map((l) => (l.valorSfAno || 0) * bases.areaSf),
      )
    : 0;

  // Mês SEM ponto na curva é ocupação ZERO, não a ocupação do mês anterior e não
  // um padrão — o oposto da curva do benchmark. Ocupação é um fato do lease-up,
  // e inventar valor para o mês não declarado criaria receita que ninguém
  // projetou. `sem_curva_ocupacao` acende vermelho quando não há ponto nenhum.
  const curvaOcupacao = new Map<number, number>();
  for (const ponto of input.ocupacao ?? []) {
    const mes = Math.trunc(ponto.mes);
    if (!Number.isInteger(ponto.mes) || mes < 1) continue;
    // Duas ocupações no mesmo mês NÃO somam — 85% + 85% não é 170%, seriam
    // contraditórias. O banco tem UNIQUE (modelagem_id, mes); aqui a última
    // vence, que é a única leitura determinística possível para dado em
    // trânsito. É a exceção deliberada à regra "duplicado soma" que vale para
    // parcelas, takedowns e aportes.
    curvaOcupacao.set(mes, clamp(ponto.ocupacaoPct || 0, 0, 1));
  }

  if (ehLocacao) {
    const perdaCredito = loc.perdaCreditoPct || 0;
    const taxaReembolso = loc.taxaReembolsoPct || 0;
    for (let m = 1; m <= prazoTotal; m++) {
      const ocupacao = curvaOcupacao.get(m) ?? 0;
      ocupacaoMes[m] = ocupacao;

      // A PERDA DE CRÉDITO INCIDE SOBRE A RECEITA FATURADA, não sobre a receita
      // a 100% de ocupação — inquilino que não existe não deixa de pagar. É por
      // isso que ela multiplica DEPOIS da ocupação, e não ao lado dela.
      //
      // E é por isso, também, que ela NÃO é vacância: a vacância física já está
      // na curva de ocupação. Somar as duas contaria o mesmo buraco duas vezes,
      // e é o erro clássico de quem escreve esta linha de memória.
      const receitaBrutaMes = (receitaBrutaAnual100 / 12) * ocupacao;
      rentalRevenue[m] = receitaBrutaMes * (1 - perdaCredito);

      // O OPEX BRUTO NÃO VARIA COM A OCUPAÇÃO. Prédio vazio custa property tax,
      // seguro e manutenção igual — a conta do síndico não cai porque não há
      // inquilino. O que varia é o REEMBOLSO, porque só quem está lá paga.
      //
      // É exatamente daí que sai o comportamento mais importante do modelo: o
      // NOI é NEGATIVO em ocupação baixa, e só vira positivo quando o reembolso
      // mais o aluguel passam do OPEX bruto. Na pro forma de referência isso
      // acontece acima de 27,8% de ocupação — ver `ocupacaoBreakevenNoi`.
      opexBruto[m] = opexBrutoAnual / 12;
      opexReembolso[m] = (opexBrutoReembolsavelAnual / 12) * taxaReembolso * ocupacao;
      opex[m] = opexBruto[m] - opexReembolso[m];
      noiMes[m] = rentalRevenue[m] - opex[m];
    }
  }

  // ─── O valor de saída ──────────────────────────────────────────────────────
  //
  // O NOI de REFERÊNCIA é anual e não se confunde com `Apuracao.noiTotal`, que é
  // o NOI acumulado do fluxo inteiro. Ver `NoiReferencia` em tipos.ts para por
  // que o padrão de mercado (forward 12m) não está implementado.
  const noiReferencia = !ehLocacao
    ? 0
    : loc.noiReferencia === 'ultimos_12m'
      ? // Trailing do fluxo efetivamente modelado: os 12 meses que TERMINAM no
        // mês de saída. O `max(1, …)` corta a janela quando a saída acontece
        // antes do 12º mês — somar meses que não existem daria um NOI menor sem
        // nada explicando por quê, e cortar deixa a soma coerente com o prazo.
        soma(
          Array.from(
            { length: Math.min(12, Math.max(0, Math.min(mesSaida, prazoTotal))) },
            (_, k) => noiMes[Math.min(mesSaida, prazoTotal) - k] ?? 0,
          ),
        )
      : // 'estabilizado' (default): a conta da pro forma de referência. Não
        // depende de o fluxo ter chegado a estabilizar — é o ativo maduro.
        receitaBrutaAnual100 * (loc.ocupacaoEstabilizadaPct || 0) * (1 - (loc.perdaCreditoPct || 0)) -
        (opexBrutoAnual -
          opexBrutoReembolsavelAnual *
            (loc.taxaReembolsoPct || 0) *
            (loc.ocupacaoEstabilizadaPct || 0));

  // ESTA É A DIVISÃO QUE DERRUBA A MODELAGEM INTEIRA SE PASSAR.
  //
  // Cap rate ZERO devolve valor de saída ZERO, nunca Infinity — e nunca NaN,
  // porque a guarda é `> 0` e não `!== 0`. Um Infinity aqui contaminaria receita,
  // lucro, MOIC, TIR e o rateio de todos os sócios, e a tela mostraria "∞" sem
  // uma linha dizendo de onde veio. `cap_rate_zerado` acende vermelho.
  const valorSaida =
    ehLocacao && (loc.capRateSaida || 0) > 0 ? noiReferencia / loc.capRateSaida : 0;

  if (ehLocacao && mesSaida >= 1 && mesSaida <= prazoTotal) {
    // Um único lançamento, no mês da saída. `custoVendaPct` faz aqui o papel que
    // comissão e cartório fazem no modo venda — e por isso os três nunca
    // coexistem.
    revenue[mesSaida] = valorSaida * (1 - (loc.custoVendaPct || 0));
  }

  for (let m = 1; m <= prazoTotal; m++) {
    if (temOverride(m, 'land')) land[m] = valorOverride(m, 'land');
    if (temOverride(m, 'construction')) construction[m] = valorOverride(m, 'construction');
    if (temOverride(m, 'property_tax')) propertyTax[m] = valorOverride(m, 'property_tax');
    if (temOverride(m, 'other_costs')) otherCosts[m] = valorOverride(m, 'other_costs');
    if (temOverride(m, 'revenue')) revenue[m] = valorOverride(m, 'revenue');
    // Override VENCE também nas duas linhas novas, como em toda linha do fluxo.
    // Forçar `opex` não muda `opexBruto` nem `opexReembolso`: aqueles continuam
    // mostrando a conta que o motor fez, e a diferença para `opex` é justamente
    // o ajuste manual que a grade exibe.
    if (temOverride(m, 'rental_revenue')) rentalRevenue[m] = valorOverride(m, 'rental_revenue');
    if (temOverride(m, 'opex')) opex[m] = valorOverride(m, 'opex');
    // O NOI acompanha o que ficou de pé depois dos overrides: é uma leitura
    // derivada, não uma linha editável — como "Total de pagamentos".
    noiMes[m] = rentalRevenue[m] - opex[m];
  }

  // ─── Contexto de cada facilidade ───────────────────────────────────────────
  //
  // Tudo que depende só do CONTRATO — teto, base do fee, convenção de juros,
  // curva do benchmark, reserva e release — é resolvido UMA vez aqui, por
  // facilidade, e reusado no loop mensal e nas conferências. Resolver dentro do
  // loop refaria a mesma conta em todo mês de toda passada do ponto fixo, e —
  // pior — abriria espaço para a conferência cobrar um número diferente do que
  // o cálculo usou.
  //
  // O array é PARALELO a `facilidades`, inclusive nas inativas: o índice é o
  // endereço das chaves de override, e compactá-lo remapearia `draw:2` para
  // outra facilidade em silêncio.
  const ctxFacilidades = facilidades.map((f, i) => {
    const teto =
      f.valorContratado != null
        ? f.valorContratado
        : f.maxLtcPct != null
          ? f.maxLtcPct * (terrenosTotal + obraTotal)
          : Number.POSITIVE_INFINITY;

    /**
     * Base do fee de estruturação DESTA facilidade: o COMPROMISSO do banco, não
     * o giro.
     *
     * Antes desta correção o fee incidia sobre `dividaSacada` — o total sacado
     * ao longo da vida. Numa linha rotativa isso é um múltiplo do contratado,
     * porque amortizar devolve limite e o mesmo dinheiro é sacado várias vezes;
     * o fee inflava junto e ainda realimentava o ponto fixo pelo custo
     * financeiro.
     *
     * Resolve na mesma ordem de precedência do teto de dívida, porque é o mesmo
     * compromisso: valor contratado primeiro, LTC máximo depois.
     *
     * Sem teto nenhum (os dois nulos) não existe valor contratado a que se
     * referir, e o teto é Infinity — que não pode virar base de cálculo. A base
     * passa a ser o PICO do saldo devedor DESTA facilidade, a maior exposição
     * que este banco teve, e `fee_sem_base_contratada` acende âmbar pedindo o
     * valor contratado.
     *
     * O fee é POR FACILIDADE, sobre o valor contratado de CADA UMA: duas
     * facilidades de $5M com fee de 1% custam $50.000 e $50.000, não $100.000
     * sobre um contratado somado que não existe em contrato nenhum.
     *
     * PONTO DE EXTENSÃO: se algum contrato cobrar o fee por desembolso, é aqui
     * que um campo `base_fee_estruturacao` entraria — e em lugar nenhum mais.
     */
    const baseFee = (picoSaldoDevedor: number): number => {
      if (f.valorContratado != null) return f.valorContratado;
      if (f.maxLtcPct != null) return f.maxLtcPct * (terrenosTotal + obraTotal);
      return picoSaldoDevedor;
    };

    // ─── Taxa efetiva do mês ─────────────────────────────────────────────────
    // Com taxa fixa é `taxaAnual`, constante, e o resultado é o de sempre. Com
    // taxa variável é (curva do benchmark naquele mês, ou o padrão) + spread — e
    // mês sem ponto na curva NÃO é benchmark zero: cai no padrão, e a
    // conferência `benchmark_incompleto` diz quantos meses caíram nele.
    //
    // A curva é POR FACILIDADE: duas dívidas indexadas ao mesmo benchmark ainda
    // podem ter spreads diferentes, e uma pode ser fixa enquanto a outra é
    // variável.
    const curvaBenchmark = new Map<number, number>();
    for (const ponto of f.benchmarkCurva ?? []) {
      if (Number.isInteger(ponto.mes) && ponto.mes >= 1) {
        curvaBenchmark.set(ponto.mes, ponto.valor || 0);
      }
    }
    const taxaEfetivaDoMes = (m: number) =>
      f.tipoTaxa === 'variavel'
        ? (curvaBenchmark.get(m) ?? f.benchmarkPadrao ?? 0) + (f.spread || 0)
        : f.taxaAnual || 0;

    // ─── Release price ───────────────────────────────────────────────────────
    // Valor fixo tem precedência sobre o percentual — ver o COMMENT da coluna. O
    // percentual incide sobre o preço BRUTO das unidades que fecham no mês, não
    // sobre a receita líquida: é assim que o contrato é escrito, e a comissão do
    // corretor não reduz o que o banco leva.
    //
    // Alvo PRETENDIDO do mês, antes de qualquer teto. É a ÚNICA fonte do
    // release: a previsão do passo 1, a amortização do passo 3 e o total que a
    // conferência examina saem todos daqui, e por isso não têm como divergir.
    // `vendasPorMes` é a mesma série que alimenta o gatilho de custo 'por_venda'
    // e `MesFluxo.unidadesVendidas` — e é VAZIA no modo locação, onde não há
    // unidade fechando em mês nenhum.
    const releasePrice = Math.max(0, f.releasePrice || 0);
    const releasePct = f.releasePricePct ?? null;
    const releaseBrutoDoMes = (m: number, unidadesNoMes = vendasPorMes.get(m) ?? 0) => {
      if (releasePrice > 0) return releasePrice * unidadesNoMes;
      // Valor bruto REAL das unidades que fecham no mês, não o preço médio vezes
      // a contagem: com tipologias de preços diferentes a média cobraria release
      // a mais nas baratas e a menos nas caras. Num projeto de preço uniforme os
      // dois são o mesmo número.
      if (releasePct != null) return releasePct * (valorVendidoPorMes.get(m) ?? 0);
      return 0;
    };

    // Facilidade em ciclo de refinanciamento PARA de refinanciar. Não é
    // "escolher uma das duas": as duas param, e `refinanciamento_circular`
    // acende vermelho. Quebrar o laço em silêncio faria o resultado depender da
    // ordem de visita do grafo.
    const alvoRefin = f.refinanciaIndex;
    const refinancia =
      alvoRefin != null &&
      Number.isInteger(alvoRefin) &&
      alvoRefin >= 0 &&
      alvoRefin < facilidades.length &&
      !emCicloRefin.has(i)
        ? alvoRefin
        : null;

    return {
      indice: i,
      fin: f,
      ativa: facilidadeAtiva[i],
      nome: f.nome || 'Financiamento',
      teto,
      baseFee,
      convencao: (f.convencaoJuros ?? 'mensal_12') as ConvencaoJuros,
      taxaEfetivaDoMes,
      reservaJuros: Math.max(0, f.reservaJuros || 0),
      reservaSacada: f.reservaJurosSacada !== false,
      releaseBrutoDoMes,
      refinancia,
    };
  });

  /** Só as ativas, na ordem de precedência. É esta lista que o mês percorre. */
  const ativas = ctxFacilidades.filter((c) => c.ativa);

  /**
   * Teto de dívida do PROJETO: a soma dos tetos das facilidades ativas.
   *
   * Uma facilidade sem teto nenhum torna a soma Infinity, exatamente como já
   * acontecia quando havia só uma. Com uma facilidade o número é idêntico ao de
   * antes.
   */
  const tetoDivida = ativas.length
    ? ativas.reduce((a, c) => a + c.teto, 0)
    : Number.POSITIVE_INFINITY;

  /**
   * Colchão mínimo de caixa do PROJETO: o MAIOR entre os das facilidades ativas.
   *
   * É um piso de saldo em conta, não uma soma: dois bancos exigindo $200.000 e
   * $500.000 de colchão são atendidos mantendo $500.000, não $700.000. Somar
   * inflaria a demanda de caixa e, com ela, o saque e o juro do projeto inteiro.
   *
   * Com uma facilidade é o valor dela, como sempre foi. Sem nenhuma é zero.
   */
  const colchao = ativas.length
    ? Math.max(0, ...ativas.map((c) => c.fin.colchaoMinimoCaixa || 0))
    : 0;

  /**
   * O custo financeiro entra na demanda de caixa?
   *
   * Basta UMA facilidade com a flag ligada: a demanda do mês é uma só e
   * compartilhada, e se qualquer dívida financia o próprio custo financeiro,
   * esse custo precisa estar dimensionado na demanda. Com uma facilidade é
   * exatamente a flag dela.
   */
  const custoFinanceiroNaDemanda = ativas.some((c) => c.fin.custoFinanceiroNaDemanda);

  // ─── Amortização: só release e quitação na saída ───────────────────────────
  // Sobraram DOIS modos, e o passo 3 é a implementação inteira dos dois:
  //   'at_exit' — o saldo remanescente sai no mês da saída;
  //   'manual'  — nada automático, só overrides.
  // O release por unidade vendida amortiza nos dois, porque não é modo: é
  // cláusula do contrato. O REFINANCIAMENTO também amortiza nos dois, e pela
  // mesma razão — é cláusula, não modo.
  //
  // 'price' e 'sac' (prestação, carência, vencimento e balloon) foram removidos
  // pela migration 1763400000, depois de o passo 3 ter passado a ser release +
  // quitação na saída — a partir dali os dois já produziam exatamente o mesmo
  // ModelOutput que 'manual', e a migration converteu as linhas para 'manual'
  // sem mudar número nenhum.
  //
  // `prazoMeses`, `carenciaMeses`, `amortizacaoMeses` e `balloonNoVencimento`
  // continuam no input e no banco por compatibilidade, e NÃO têm efeito em lugar
  // nenhum. Quem for reintroduzir a prestação: é aqui e no passo 3, e a previsão
  // do passo 1 tem de aprender a mesma conta, senão o saque volta a ser
  // dimensionado a menos e o caixa volta a fechar negativo.
  // ─── Aporte previsto de cada mês (migration 1763200000) ────────────────────
  // O que o passo 5 VAI lançar de equity em cada mês, resolvido ANTES do loop
  // porque o passo 1 precisa dele: é o desconto do aporte do PRÓPRIO mês que
  // impede o modo 'equity_first_demanda' de sacar no mês 1 quando o aporte já
  // cobriria tudo.
  //
  // A ordem espelha EXATAMENTE a do passo 5, e não a invariante geral "override
  // sempre vence": em 'cronograma_socio' o passo 5 ignora o override de
  // equity_call, porque ali o equity do mês é a soma de aportes de sócios
  // NOMEADOS e o override não diz de quem é o dinheiro. Uma previsão que não
  // bate com o que vai ser lançado faz o saque descontar dinheiro que não entra,
  // e o mês fecha abaixo do colchão exatamente nessa diferença.
  //
  // No modo de aporte 'demanda' o previsto é ZERO em todo mês, e isso é
  // DELIBERADO: ali o aporte é o RESÍDUO do caixa, calculado no passo 5 DEPOIS
  // do saque. Se o saque o descontasse, os dois se anulariam — "aporte = demanda
  // − saque" e "saque = demanda − aporte" são a mesma equação escrita duas
  // vezes, sem solução única, e o ponto fixo passaria a oscilar entre "tudo
  // saque" e "tudo aporte". É a primeira coisa que alguém vai tentar consertar
  // aqui; não conserte.
  const aportePrevisto = zeros();
  for (let m = 1; m <= prazoTotal; m++) {
    aportePrevisto[m] =
      regraCapital === 'cronograma_socio'
        ? (aporteSociosPorMes.get(m) ?? 0)
        : temOverride(m, 'equity_call')
          ? valorOverride(m, 'equity_call')
          : modoAporte === 'plano'
            ? (parcelaPorMes.get(m) ?? 0)
            : 0;
  }

  // ─── Uma passada do loop mensal ────────────────────────────────────────────
  // ─── Uma passada do loop mensal ────────────────────────────────────────────
  const passe = (estado: EstadoPonto): ResultadoPasse => {
    const meses: MesFluxo[] = [];
    // Quanto da demanda do mês o TETO impediu de sacar, acumulado no passe
    // inteiro. Alimenta `teto_divida`, que só assim consegue dizer quanto de
    // aporte a mais fecharia o caixa.
    let mesesNoTeto = 0;
    let descobertoPorTeto = 0;
    let caixaAcumulado = 0;
    let obraAcumulada = 0;
    let equityAcumulado = 0;
    // Release que o teto do saldo de abertura cortou, somado no passe inteiro.
    // Alimenta `release_insuficiente`: é dívida que as vendas queriam quitar e
    // não havia mais.
    let releaseCortadoTotal = 0;
    const refinanciamentoDescoberto: {
      refinanciadora: number;
      refinanciada: number;
      falta: number;
    }[] = [];

    // ─── Estado POR FACILIDADE, atravessando os meses ────────────────────────
    // Arrays paralelos a `facilidades` (a lista completa), não a `ativas`: o
    // índice é o mesmo endereço usado pelas chaves de override.
    const saldoAnterior = facilidades.map(() => 0);
    const sacadoAte = facilidades.map(() => 0);
    const jaHouveSaque = facilidades.map(() => false);
    const saldoReserva = facilidades.map(() => 0);
    // O refinanciamento acontece UMA vez por par: no primeiro mês em que a
    // facilidade que refinancia entra em janela e há saldo a quitar.
    const jaRefinanciou = facilidades.map(() => false);

    for (let m = 1; m <= prazoTotal; m++) {
      // OPEX entra em `pagamentosOperacionais` junto de terreno, obra, property
      // tax e custos do orçamento: é saída de caixa operacional como qualquer
      // outra, e no modo venda vale zero — a soma é a de sempre.
      const pagamentosOperacionais =
        land[m] + construction[m] + propertyTax[m] + otherCosts[m] + opex[m];
      const caixaAbertura = caixaAcumulado;
      obraAcumulada += construction[m];

      // Unidades que fecham no mês — a mesma série que alimenta o gatilho de
      // custo 'por_venda' e `MesFluxo.unidadesVendidas`. Uma fonte só, para as
      // leituras não divergirem. Vazia no modo locação.
      const unidadesNoMes = vendasPorMes.get(m) ?? 0;

      // ─── PRÉ-PASSO: o que cada facilidade traz para o mês ──────────────────
      // Tudo aqui depende só do contrato e do saldo de ABERTURA — nada depende
      // do saque —, então pode ser apurado antes de qualquer decisão de saque. É
      // isso que permite dimensionar a demanda do mês uma vez só, para todas.
      const pre = ativas.map((c) => {
        const i = c.indice;
        const saldoAbertura = saldoAnterior[i];

        // Capacidade de saque do mês.
        //
        // Linha ROTATIVA (migration 1763300000): amortizar devolve limite, então
        // o que importa é a POSIÇÃO EM ABERTO, não o total já desembolsado na
        // vida do empréstimo. Não rotativa (default, e toda modelagem já
        // gravada): o teto vale para o total desembolsado, e capacidade
        // consumida não volta.
        //
        // Nos dois casos a base é o saldo de ABERTURA, nunca o saldo depois do
        // saque ou depois da amortização do próprio mês. Duas razões:
        //   1. o saldo pós-saque depende do saque, e o saque dependeria do
        //      saldo — é a mesma circularidade que o teto do release cria, e ela
        //      empurra o ponto fixo sem convergir para caixa fechado;
        //   2. contratualmente o pedido de saque é avaliado contra a posição em
        //      aberto NO MOMENTO DO PEDIDO, não contra a posição depois da
        //      liquidação da venda do mesmo mês. É a leitura conservadora e a
        //      única autoconsistente.
        const capacidade = c.fin.linhaRotativa
          ? Math.max(0, c.teto - saldoAbertura)
          : Math.max(0, c.teto - sacadoAte[i]);
        const dentroJanela = m >= c.fin.mesInicioSaque && m <= c.fin.mesFimSaque;

        // Taxa e fator do mês, apurados ANTES do passo 1 porque o teto do
        // release precisa dos juros previstos sobre o saldo de abertura.
        // Dependem só de `m` e do contrato — não do saque —, então subi-los não
        // muda número nenhum.
        const taxaEfetivaAno = c.taxaEfetivaDoMes(m);
        const fatorMes = fatorJurosDoMes(
          c.convencao,
          taxaEfetivaAno,
          somarMeses(input.dataInicio, m - 1),
        );

        // ─── Release do mês ─────────────────────────────────────────────────
        const releaseBruto = c.releaseBrutoDoMes(m, unidadesNoMes);

        // TETO PELO SALDO DE ABERTURA, não pelo saldo depois do saque do mês.
        // Sem isto, cada dólar sacado libera um dólar a mais de amortização, o
        // caixa nunca melhora e o ponto fixo empurra o saque para cima sem
        // convergir para um caixa fechado. Ninguém toma emprestado hoje para
        // amortizar hoje o mesmo empréstimo — e o motor não pode modelar isso.
        const jurosPrevistosSobreAbertura = saldoAbertura * fatorMes;
        const tetoRelease =
          saldoAbertura + (c.fin.capitalizarJuros ? jurosPrevistosSobreAbertura : 0);
        const alvoRelease = clamp(releaseBruto, 0, tetoRelease);
        releaseCortadoTotal += Math.max(0, releaseBruto - alvoRelease);

        // Amortização PREVISTA — release do mês mais, no mês da saída, o
        // remanescente do saldo de abertura.
        //
        // max(0, saldoAbertura − alvoRelease) evita a soma dupla: no mês da
        // saída, o que o release já amortiza não precisa ser pedido de novo. Sem
        // isso o motor pede o dobro e o saque sai inflado no último mês.
        //
        // O REFINANCIAMENTO NÃO ENTRA NESTA PREVISÃO, e é deliberado: ele é
        // financiado pelo saque da facilidade que refinancia, não pelo caixa do
        // projeto — a quitação e o saque se anulam no mesmo mês. Somá-lo à
        // demanda faria o projeto sacar de novo, de terceiros, dinheiro que já
        // está coberto.
        const amortPrevista =
          alvoRelease +
          (c.fin.modoAmortizacao === 'at_exit' && m === mesSaida
            ? Math.max(0, saldoAbertura - alvoRelease)
            : 0);

        return { c, i, saldoAbertura, capacidade, dentroJanela, taxaEfetivaAno, fatorMes, alvoRelease, amortPrevista };
      });

      // ─── A demanda de caixa do mês, UMA para todas as facilidades ─────────
      //
      // `custoFinEstimado` vem do ponto fixo: é o custo financeiro que a passada
      // anterior apurou para ESTE mês, somado sobre todas as facilidades. Com a
      // flag desligada em todas é zero, e aí os juros do mês saem do caixa sem
      // ter entrado no dimensionamento.
      //
      // `rentalRevenue[m]` entra ao lado de `revenue[m]`: é entrada de caixa do
      // mês como qualquer outra, e vale zero no modo venda.
      const custoFinEstimado = custoFinanceiroNaDemanda ? (estado.custoFinPorMes[m] ?? 0) : 0;
      const amortPrevistaTotal = soma(pre.map((x) => x.amortPrevista));
      const demandaSemAporte =
        pagamentosOperacionais +
        custoFinEstimado +
        amortPrevistaTotal +
        colchao -
        revenue[m] -
        rentalRevenue[m] -
        caixaAbertura;
      const demandaLiquidaDeAporte = demandaSemAporte - aportePrevisto[m];

      // ─── PRECEDÊNCIA DENTRO DO MÊS ────────────────────────────────────────
      //
      // ESTE É O PONTO EM QUE A `ordem` DAS FACILIDADES DEFINE O RESULTADO, e
      // não só a exibição: nos modos dimensionados por demanda, a primeira
      // facilidade saca o que couber no teto dela e SÓ O QUE SOBRAR chega à
      // segunda. Trocar duas facilidades de ordem, com tetos e taxas diferentes,
      // muda o juro do projeto inteiro.
      //
      // Três poços, porque os modos medem coisas diferentes e uma facilidade não
      // pode consumir o poço de um modo que não é o dela:
      //   `restanteDemanda`    — o do 'cash_demand', que ignora o aporte do mês;
      //   `restanteDemandaLiq` — o do 'equity_first_demanda', líquido do aporte;
      //   `restanteObra`       — o do 'equity_first', que é cobertura de OBRA e
      //                          não de caixa.
      //
      // Os dois primeiros são decrementados por QUALQUER saque, inclusive o de
      // uma facilidade em 'equity_first': dinheiro que entrou é dinheiro que
      // entrou, e a segunda facilidade não deve sacar de novo o que a primeira
      // já cobriu. O terceiro só pelos saques de 'equity_first', porque medir
      // cobertura de obra com dinheiro sacado por demanda de caixa misturaria
      // duas grandezas.
      //
      // Com UMA facilidade — o estado de toda modelagem já gravada — nenhum
      // decremento chega a ser lido, e cada modo produz exatamente o mesmo
      // número de antes.
      let restanteDemanda = demandaSemAporte;
      let restanteDemandaLiq = demandaLiquidaDeAporte;
      let restanteObra = Math.min(
        Math.max(0, obraAcumulada - equityDisponivelObraAte(m)),
        construction[m],
      );

      const porFacilidade: FacilidadeMes[] = [];
      let drawMes = 0;
      let amortizacaoMes = 0;
      let jurosMes = 0;
      let feeMes = 0;
      let saldoDevedorMes = 0;
      let capacidadeMes = 0;
      let saqueReservaMes = 0;
      let jurosPelaReservaMes = 0;
      let saldoReservaMes = 0;
      let custoFinanceiroCaixa = 0;
      let amortizacaoReleaseMes = 0;
      let amortPrevistaMes = 0;
      let bindouNoTeto = false;
      // Saldo devedor VIVO de cada facilidade neste momento do mês. Começa no
      // saldo de abertura e é fechado quando a facilidade é processada; é daqui
      // que o refinanciamento lê o que precisa quitar.
      const saldoVivo = facilidades.map((_, i) => saldoAnterior[i]);
      const amortizacaoDaFacilidade = facilidades.map(() => 0);

      for (const x of pre) {
        const { c, i, saldoAbertura, capacidade, dentroJanela, fatorMes, alvoRelease } = x;
        amortPrevistaMes += x.amortPrevista;
        capacidadeMes += capacidade;

        // 1. SAQUE — vem antes da amortização, porque no modo at_exit a
        //    amortização precisa conhecer o saque do próprio mês. Para não
        //    fechar o círculo no cash_demand, o saque usa uma amortização
        //    PREVISTA (só o saldo de abertura), não a definitiva.
        const chaveDraw = chaveFacilidade('draw', i + 1);
        const temOverrideDraw = temOverride(m, chaveDraw);
        let draw: number;
        // A demanda que DIMENSIONOU o saque desta facilidade. Nos modos que não
        // dimensionam por demanda ela é só leitura da aba Demanda de Caixa.
        let demandaDoSaque = restanteDemandaLiq;
        if (temOverrideDraw) {
          // Override de saque vence sempre, inclusive acima do teto: nesse caso
          // a conferência acende vermelho, mas o cálculo segue.
          draw = valorOverride(m, chaveDraw);
        } else if (c.fin.modoSaque === 'equity_first') {
          // Regra clássica: o capital próprio entra primeiro na obra. Só há
          // saque depois que a obra acumulada ultrapassa o equity disponível
          // para obra.
          //
          // O teto pela obra do mês é o que deixa terreno, property tax, custos
          // do orçamento e custo financeiro sem cobertura de dívida — e é
          // exatamente isso que o modo 'equity_first_demanda' resolve. Aqui não
          // se mexe: é o resultado de toda modelagem já gravada.
          draw = dentroJanela ? clamp(restanteObra, 0, capacidade) : 0;
        } else if (c.fin.modoSaque === 'cash_demand') {
          // Dimensiona a dívida pela necessidade real de caixa do mês. Ignora o
          // aporte do próprio mês de propósito — ver o modo abaixo.
          demandaDoSaque = restanteDemanda;
          draw = dentroJanela ? clamp(restanteDemanda, 0, capacidade) : 0;
        } else if (c.fin.modoSaque === 'equity_first_demanda') {
          // O capital próprio entra primeiro porque é descontado da demanda: só
          // sobra saque quando o aporte do mês, a receita e o caixa de abertura
          // não cobrem os pagamentos mais o colchão.
          //
          // Diferente do 'cash_demand', que ignora o aporte do próprio mês e por
          // isso saca no mês 1 mesmo quando o aporte já cobriria tudo —
          // deixando dinheiro parado em caixa pagando juros.
          //
          // clamp(…, 0, capacidade): mês superavitário não gera saque NEGATIVO
          // (o saque não é devolução de principal — quem devolve é a
          // amortização), e o teto continua sendo o teto. Quando a demanda passa
          // da capacidade o caixa fica negativo de novo — e é justamente isso
          // que `teto_divida` conta logo abaixo.
          //
          // Fora da janela de saque o saque é ZERO e o buraco fica. É correto:
          // janela é contrato, não preferência — o banco não libera dinheiro em
          // mês nenhum fora dela, e inventar saque ali esconderia um problema de
          // cronograma que `caixa_minimo` tem de mostrar.
          draw = dentroJanela ? clamp(restanteDemandaLiq, 0, capacidade) : 0;
        } else {
          draw = 0; // 'manual' → só overrides
        }

        // ─── REFINANCIAMENTO — o coração do modo locação ────────────────────
        //
        // A construção sai numa facilidade cara e curta; quando o ativo
        // estabiliza, um permanent loan barato entra, QUITA a primeira e fica no
        // lugar dela. Sem este vínculo o motor veria dois saques e nenhuma
        // amortização, e a dívida do projeto dobraria em silêncio.
        //
        // O gatilho é o PRIMEIRO MÊS em que esta facilidade entra na janela de
        // saque com algo a quitar do outro lado — e não "o primeiro mês em que
        // ela saca por demanda", porque um permanent loan tipicamente não tem
        // demanda de caixa nenhuma: o refinanciamento É o motivo dele existir, e
        // esperar por uma demanda que nunca vem deixaria a dívida velha de pé o
        // projeto inteiro.
        //
        // A ORDEM DENTRO DO MÊS É O QUE FAZ A CONTA FECHAR: a facilidade
        // refinanciada precisa vir ANTES na `ordem`, para já ter calculado os
        // juros e fechado o saldo quando esta saca. Vindo depois, o saque quita
        // um saldo que ainda não incorporou o juro do mês e sobra um resíduo —
        // que fica VISÍVEL, porque o saldo devedor dela não zera e
        // `saldo_devedor_final` acusa, em vez de sumir na diferença.
        let refinanciado = 0;
        if (c.refinancia != null && !jaRefinanciou[i] && dentroJanela) {
          const alvo = c.refinancia;
          const saqueMinimo = Math.max(0, saldoVivo[alvo]);
          if (saqueMinimo > TOL_CONVERGENCIA) {
            jaRefinanciou[i] = true;
            // "Ao menos o saldo da outra, respeitando o próprio teto." O
            // refinanciamento é SOMADO ao saque de demanda, não comparado com
            // ele: a facilidade precisa financiar as duas coisas — o buraco de
            // caixa do mês e a quitação da dívida velha. Tratar como `max`
            // deixaria o projeto sem o dinheiro do mês.
            refinanciado = Math.min(saqueMinimo, capacidade);
            if (!temOverrideDraw) draw = clamp(draw + refinanciado, 0, capacidade);
            // Override VENCE, também aqui: se o usuário forçou o saque desta
            // facilidade, a quitação não pode passar do que de fato foi sacado —
            // senão apareceria dinheiro que ninguém pôs.
            refinanciado = Math.min(refinanciado, Math.max(0, draw));
            const falta = saqueMinimo - refinanciado;
            if (falta > TOL_CONVERGENCIA) {
              refinanciamentoDescoberto.push({
                refinanciadora: i,
                refinanciada: alvo,
                falta,
              });
            }
          }
        }

        sacadoAte[i] += draw;
        drawMes += draw;

        // Cobertura do mês. O clamp: saque ACIMA da demanda — override, ou o
        // saque do equity_first quando a obra do mês passa da necessidade —
        // sobra em caixa, não é cobertura.
        //
        // Os poços de demanda são decrementados por QUALQUER saque; o de obra,
        // só pelo saque de quem está em 'equity_first'.
        restanteDemanda -= draw;
        restanteDemandaLiq -= draw;
        if (c.fin.modoSaque === 'equity_first') restanteObra -= draw;

        // O teto BINDOU nesta facilidade: havia demanda, o mês estava dentro da
        // janela e a capacidade foi o limite. Contado só no modo novo — nos
        // outros o saque não é dimensionado por esta demanda, e contá-los mudaria
        // o texto de `teto_divida` em modelagem já gravada.
        if (
          c.fin.modoSaque === 'equity_first_demanda' &&
          !temOverrideDraw &&
          dentroJanela &&
          demandaDoSaque > capacidade + TOL_CONVERGENCIA
        ) {
          bindouNoTeto = true;
        }

        // 1b. RESERVA DE JUROS — constituída no PRIMEIRO SAQUE, um único mês.
        //     Sacada: sai do próprio empréstimo, soma ao principal e rende juros
        //     como qualquer principal, mas NÃO passa pelo caixa do projeto (o
        //     dinheiro vai direto para a conta da reserva). Orçamentária: só abre
        //     o saldo, sem mexer em dívida nem em chamada de capital.
        const ehPrimeiroSaque = !jaHouveSaque[i] && draw > 0;
        if (ehPrimeiroSaque) jaHouveSaque[i] = true;
        const constituiReserva = ehPrimeiroSaque && c.reservaJuros > 0;
        const saqueReservaJuros = constituiReserva && c.reservaSacada ? c.reservaJuros : 0;
        if (constituiReserva) saldoReserva[i] = c.reservaJuros;
        sacadoAte[i] += saqueReservaJuros;
        saqueReservaMes += saqueReservaJuros;

        // 2. JUROS — dependem só do saldo já sacado, então já podem ser apurados.
        const saldoAntes = saldoAbertura + draw + saqueReservaJuros;
        const juros = saldoAntes * fatorMes;
        jurosMes += juros;

        // 2b. A reserva paga PRIMEIRO, a capitalização vem DEPOIS. A ordem
        //     importa: invertida, o juro viraria principal antes de a reserva ter
        //     chance de absorvê-lo, e a reserva nunca esvaziaria. Os dois
        //     recursos coexistem — a reserva não substitui `capitalizarJuros`.
        const jurosPagosPelaReserva = Math.min(juros, saldoReserva[i]);
        saldoReserva[i] -= jurosPagosPelaReserva;
        jurosPelaReservaMes += jurosPagosPelaReserva;
        saldoReservaMes += saldoReserva[i];
        const jurosAposReserva = juros - jurosPagosPelaReserva;

        // Com capitalização, o que sobrou vira principal ANTES da amortização;
        // senão o saldo final do mês de saída ficaria com um mês de juros
        // pendurado.
        const baseAmortizavel = saldoAntes + (c.fin.capitalizarJuros ? jurosAposReserva : 0);

        // 3. AMORTIZAÇÃO — release do mês, mais a quitação no mês de saída.
        //
        //    `alvoRelease` NÃO é recalculado aqui: é exatamente o número que o
        //    passo 1 previu, já limitado pelo saldo de ABERTURA. Previsão e
        //    realização usando o mesmo número é o que faz o saque dimensionado
        //    chegar inteiro ao caixa — recalcular contra `baseAmortizavel` (que
        //    já contém o saque do mês) reabriria a circularidade.
        //
        //    max(0, baseAmortizavel − alvoRelease) no mês da saída: o release já
        //    amortizou uma parte, e o at_exit cobre só o remanescente.
        //
        //    O clamp final continua sendo a proteção contra saldo devedor
        //    negativo por override abusivo.
        const chaveAmort = chaveFacilidade('amortization', i + 1);
        let alvoAmort: number;
        if (temOverride(m, chaveAmort)) {
          // Override vence tudo — inclusive o release.
          alvoAmort = valorOverride(m, chaveAmort);
        } else {
          const parteExit =
            c.fin.modoAmortizacao === 'at_exit' && m === mesSaida
              ? Math.max(0, baseAmortizavel - alvoRelease)
              : 0;
          alvoAmort = alvoRelease + parteExit;
        }
        const amortization = clamp(alvoAmort, 0, baseAmortizavel);
        const saldoDepois = baseAmortizavel - amortization;
        // Quanto da amortização do mês foi release, para a grade do fluxo poder
        // decompor "Release: X · Saída: Y" sem refazer a conta.
        amortizacaoReleaseMes += Math.min(amortization, alvoRelease);

        // ─── A quitação da facilidade REFINANCIADA ─────────────────────────
        // Ela já foi processada neste mês (vem antes na ordem) e o saldo dela
        // está fechado: a quitação é aplicada agora, sobre o saldo vivo, e
        // nunca o deixa negativo.
        if (refinanciado > 0) {
          const alvo = c.refinancia as number;
          const quitado = Math.min(refinanciado, Math.max(0, saldoVivo[alvo]));
          saldoVivo[alvo] -= quitado;
          amortizacaoDaFacilidade[alvo] += quitado;
          amortizacaoMes += quitado;
        }

        saldoVivo[i] = saldoDepois;
        amortizacaoDaFacilidade[i] += amortization;
        amortizacaoMes += amortization;

        // 4. FEE — por facilidade, sobre o valor contratado de CADA UMA.
        const fee =
          (c.fin.feeTiming === 'first_draw' ? ehPrimeiroSaque : m === c.fin.feeMes)
            ? (estado.feePorFacilidade[i] ?? 0)
            : 0;
        feeMes += fee;

        // Juros capitalizados não saem do caixa (viram principal), mas continuam
        // na apuração de resultado como custo financeiro incorrido. O que a
        // reserva pagou também não sai do caixa — é isso que ela existe para
        // fazer.
        custoFinanceiroCaixa += (c.fin.capitalizarJuros ? 0 : jurosAposReserva) + fee;

        porFacilidade.push({
          id: c.fin.id,
          indice: i,
          nome: c.nome,
          draw,
          // Preenchidos no fecho do mês: a amortização de uma facilidade pode
          // crescer DEPOIS de ela ser processada, quando outra a refinancia.
          amortization: 0,
          juros,
          fee,
          saldoDevedor: 0,
          capacidadeSaque: capacidade,
        });
      }

      // Fecho por facilidade: amortização e saldo definitivos, já com o efeito
      // do refinanciamento aplicado por quem veio depois na ordem.
      for (const linha of porFacilidade) {
        linha.amortization = amortizacaoDaFacilidade[linha.indice];
        linha.saldoDevedor = saldoVivo[linha.indice];
      }
      for (let i = 0; i < facilidades.length; i++) saldoAnterior[i] = saldoVivo[i];
      saldoDevedorMes = soma(porFacilidade.map((x) => x.saldoDevedor));

      // ─── Leituras do mês, agregadas ──────────────────────────────────────
      //
      // `demandaDoSaqueMes` é a demanda da PRIMEIRA facilidade ativa, na leitura
      // do modo dela — com uma facilidade é exatamente o número de antes. Ela
      // existe para a aba Demanda de Caixa mostrar a MESMA conta que dimensionou
      // o saque; recomputá-la lá abriria espaço para as duas divergirem.
      const primeira = ativas[0];
      const demandaDoSaqueMes =
        primeira && primeira.fin.modoSaque === 'cash_demand'
          ? demandaSemAporte
          : demandaLiquidaDeAporte;
      const demandaDimensionada = Math.max(0, demandaDoSaqueMes);
      const demandaCoberta = clamp(drawMes, 0, demandaDimensionada);
      const demandaDescoberta = Math.max(0, demandaDimensionada - drawMes);

      if (bindouNoTeto) {
        mesesNoTeto += 1;
        descobertoPorTeto += Math.max(0, demandaDoSaqueMes - drawMes);
      }

      const pagamentos = pagamentosOperacionais + custoFinanceiroCaixa;

      // 5. APORTE DE EQUITY — a receita do mês cobre os custos do próprio mês.
      //    No mês da venda isso significa que não há chamada de capital para
      //    pagar juros e property tax daquele mês: o dinheiro da venda já entrou.
      //    Precedência, nesta ordem: override manual, parcela do plano, resíduo.
      //    No modo 'plano' o mês sem parcela recebe ZERO e o caixa fica negativo
      //    se o plano não cobrir a demanda — é exatamente o que o usuário quer
      //    enxergar, e a conferência de caixa mínimo acusa.
      //    A regra 'cronograma_socio' vem ANTES do override, e é a ÚNICA exceção
      //    à invariante "override sempre vence" em todo o módulo. O motivo é que
      //    ali o equity do mês não é um número solto: é a soma de aportes
      //    atribuídos a sócios NOMEADOS, e um override não diz de quem é o
      //    dinheiro. Aceitá-lo obrigaria o motor a adivinhar o dono — ou a
      //    quebrar a identidade Σ chamadasPorMes = equityCall, que é justamente o
      //    que garante que não há dinheiro aparecendo entre o projeto e os sócios.
      //    A célula fica somente leitura no fluxo (ver `editaPlanoDeAportes`) e a
      //    interface diz onde editar, em vez de aceitar em silêncio o que vai
      //    ignorar.
      let equityCall: number;
      if (regraCapital === 'cronograma_socio') {
        equityCall = aporteSociosPorMes.get(m) ?? 0;
      } else if (temOverride(m, 'equity_call')) {
        equityCall = valorOverride(m, 'equity_call');
      } else if (modoAporte === 'plano') {
        equityCall = parcelaPorMes.get(m) ?? 0;
      } else {
        equityCall = Math.max(
          0,
          pagamentos +
            amortizacaoMes +
            colchao -
            drawMes -
            revenue[m] -
            rentalRevenue[m] -
            caixaAbertura,
        );
      }
      equityAcumulado += equityCall;

      // 6. DISTRIBUIÇÃO
      const distribution = temOverride(m, 'distribution')
        ? valorOverride(m, 'distribution')
        : m === mesSaida
          ? estado.distribuicaoAutomatica
          : 0;

      // 7. CAIXA — com override de equity_call o caixa absorve a diferença,
      //    inclusive ficando negativo (a conferência acusa).
      // `saqueReservaJuros` fica DE FORA de propósito: o dinheiro vai direto para
      // a conta da reserva e nunca passa pelo caixa do projeto. Ele já está no
      // principal e volta pela amortização, como qualquer dívida.
      const caixaMes =
        equityCall +
        drawMes +
        revenue[m] +
        rentalRevenue[m] -
        pagamentos -
        amortizacaoMes -
        distribution;
      caixaAcumulado += caixaMes;

      meses.push({
        mes: m,
        data: somarMeses(input.dataInicio, m - 1),
        land: land[m],
        construction: construction[m],
        propertyTax: propertyTax[m],
        otherCosts: otherCosts[m],
        ocupacao: ocupacaoMes[m],
        rentalRevenue: rentalRevenue[m],
        opexBruto: opexBruto[m],
        opexReembolso: opexReembolso[m],
        opex: opex[m],
        noiMes: noiMes[m],
        pagamentosOperacionais,
        juros: jurosMes,
        jurosPagosPelaReserva: jurosPelaReservaMes,
        saldoReservaJuros: saldoReservaMes,
        fee: feeMes,
        custoFinanceiroCaixa,
        pagamentos,
        revenue: revenue[m],
        draw: drawMes,
        saqueReservaJuros: saqueReservaMes,
        amortization: amortizacaoMes,
        equityCall,
        distribution,
        saldoDevedor: saldoDevedorMes,
        equityAcumulado,
        caixaAbertura,
        caixaMes,
        caixaAcumulado,
        demandaBruta: pagamentos + amortizacaoMes - revenue[m] - rentalRevenue[m],
        demandaDimensionada,
        demandaCoberta,
        demandaDescoberta,
        amortizacaoPrevista: amortPrevistaMes,
        amortizacaoRelease: amortizacaoReleaseMes,
        capacidadeSaque: capacidadeMes,
        // Taxa da PRIMEIRA facilidade ativa. Não é média ponderada de propósito:
        // com saldo zero a ponderação seria 0/0, e com uma facilidade — o caso
        // de toda modelagem já gravada — este é exatamente o número de antes. A
        // taxa de cada uma está em `porFacilidade`, que é onde ela tem sentido.
        taxaEfetivaAno: pre.length ? pre[0].taxaEfetivaAno : 0,
        unidadesVendidas: unidadesNoMes,
        equityDisponivelAcumulado: equityDisponivelObraAte(m),
        porFacilidade,
      });
    }
    return {
      meses,
      mesesNoTeto,
      descobertoPorTeto,
      releaseCortadoTotal,
      refinanciamentoDescoberto,
    };
  };

  // ─── Ponto fixo ────────────────────────────────────────────────────────────
  let estado: EstadoPonto = {
    feePorFacilidade: facilidades.map(() => 0),
    custoFinPorMes: zeros(),
    distribuicaoAutomatica: 0,
  };
  let meses: MesFluxo[] = [];
  let mesesNoTeto = 0;
  let descobertoPorTeto = 0;
  let releaseCortadoTotal = 0;
  let refinanciamentoDescoberto: ResultadoPasse['refinanciamentoDescoberto'] = [];
  let iteracoes = 0;
  let convergiu = false;

  const custoDiretoInput = terrenosTotal + obraTotal;

  for (let it = 0; it < MAX_ITERACOES; it++) {
    iteracoes = it + 1;
    // O corte pelo teto vale o da ÚLTIMA passada, como todo o resto: é a passada
    // convergida que vira resultado.
    ({
      meses,
      mesesNoTeto,
      descobertoPorTeto,
      releaseCortadoTotal,
      refinanciamentoDescoberto,
    } = passe(estado));

    // `dividaSacada` NÃO é lida aqui desde que deixou de ser a base do fee: ela
    // continua sendo apurada uma vez só, depois do ponto fixo, e alimentando
    // apuração, LTC e conferências como sempre.
    const equityTotal = soma(meses.map((x) => x.equityCall));
    const jurosTotais = soma(meses.map((x) => x.juros));
    const feeLancado = soma(meses.map((x) => x.fee));
    // O OPEX entra no custo do empreendimento também aqui, e não só na apuração
    // final: é ele que dimensiona a distribuição automática, e deixá-lo de fora
    // distribuiria um lucro maior do que existe — realimentando o ponto fixo com
    // o número errado.
    const custoEmpreendimento = soma(
      meses.map((x) => x.land + x.construction + x.propertyTax + x.otherCosts + x.opex),
    );
    // Locação: aluguel faturado no fluxo mais o valor de saída já líquido do
    // custo de venda. Venda: o VGV líquido de comissão e cartório, como sempre.
    const receitaLiquida = ehLocacao
      ? soma(meses.map((x) => x.rentalRevenue)) + valorSaida * (1 - (loc.custoVendaPct || 0))
      : vgv * fatorLiquido;
    const lucroProjeto = receitaLiquida - custoEmpreendimento - (jurosTotais + feeLancado);
    const lucroInvestidores = lucroProjeto * (rec.lucroInvestidoresPct || 0);

    // CONVERGÊNCIA. Com teto definido — valor contratado ou LTC máximo —
    // `baseFeeEstruturacao` não lê `meses`: o fee deixa de depender da passada e
    // estabiliza já na primeira iteração. Uma das três realimentações do ponto
    // fixo simplesmente desaparece.
    //
    // Sem teto nenhum o fee ainda realimenta, agora pelo PICO do saldo devedor —
    // mas de forma muito mais amortecida que pelo total desembolsado, porque o
    // pico não soma o mesmo dinheiro duas vezes quando ele é sacado, amortizado e
    // sacado de novo.
    //
    // O termo do fee CONTINUA no `delta` abaixo: com teto ele é zero da segunda
    // passada em diante e não custa nada, e sem teto é justamente ele que cobra a
    // convergência do pico.
    // O pico é POR FACILIDADE: a base do fee de cada uma é a exposição do banco
    // DELA, e um pico somado não corresponde a contrato nenhum. Facilidade
    // inativa fica com fee zero, sem sumir do array — o índice é endereço.
    const picoPorFacilidade = facilidades.map((_, i) =>
      meses.length
        ? Math.max(
            0,
            ...meses.map((x) => x.porFacilidade.find((f) => f.indice === i)?.saldoDevedor ?? 0),
          )
        : 0,
    );
    const novoFee = ctxFacilidades.map((c, i) =>
      c.ativa ? c.baseFee(picoPorFacilidade[i]) * (c.fin.feeEstruturacaoPct || 0) : 0,
    );
    const novoCustoFin = zeros();
    for (const x of meses) novoCustoFin[x.mes] = x.custoFinanceiroCaixa;
    const novaDist = equityTotal + lucroInvestidores;

    let delta = Math.abs(novaDist - estado.distribuicaoAutomatica);
    for (let i = 0; i < novoFee.length; i++) {
      delta = Math.max(delta, Math.abs(novoFee[i] - (estado.feePorFacilidade[i] ?? 0)));
    }
    for (let m = 1; m <= prazoTotal; m++) {
      delta = Math.max(delta, Math.abs(novoCustoFin[m] - estado.custoFinPorMes[m]));
    }

    estado = {
      feePorFacilidade: novoFee,
      custoFinPorMes: novoCustoFin,
      distribuicaoAutomatica: novaDist,
    };
    if (it > 0 && delta < TOL_CONVERGENCIA) {
      convergiu = true;
      break;
    }
  }

  // Release PRETENDIDO (antes do clamp pelo saldo): é ele que a conferência
  // compara com a dívida para dizer se os releases quitam o empréstimo. Somado
  // sobre TODAS as facilidades ativas — cada uma tem a própria cláusula.
  let releaseTotal = 0;
  for (const c of ativas) {
    for (let m = 1; m <= prazoTotal; m++) releaseTotal += c.releaseBrutoDoMes(m);
  }

  // ─── Apuração ──────────────────────────────────────────────────────────────
  // Nunca calcule o lucro como "receita líquida − quitação da dívida − devolução
  // do equity": isso só fecha quando fontes e usos batem exatamente, e quebra no
  // modo manual.
  const custoTerrenos = soma(meses.map((x) => x.land));
  const custoObra = soma(meses.map((x) => x.construction));
  const custoPropertyTax = soma(meses.map((x) => x.propertyTax));
  const custoOutros = soma(meses.map((x) => x.otherCosts));
  // Σ do OPEX já LÍQUIDO do reembolso dos inquilinos — é o que de fato sai do
  // caixa —, e com os overrides da linha `opex` aplicados. Zero no modo venda.
  const opexTotal = soma(meses.map((x) => x.opex));
  // O OPEX entra no custo do empreendimento porque é saída de caixa operacional
  // como qualquer outra; sem ele o lucro sairia inflado exatamente nesse valor.
  // No modo venda o termo é zero e a soma é a de sempre.
  const custoEmpreendimento =
    custoTerrenos + custoObra + custoPropertyTax + custoOutros + opexTotal;
  const jurosTotais = soma(meses.map((x) => x.juros));
  const feeTotal = soma(meses.map((x) => x.fee));
  const custoFinanceiro = jurosTotais + feeTotal;

  // ─── A RECEITA, nos dois modos ─────────────────────────────────────────────
  //
  // Venda: o VGV, deduzido de comissão e cartório.
  //
  // Locação: o aluguel faturado ao longo da operação MAIS o valor de saída
  // bruto, deduzido do custo de venda. `comissoes` e `cartorio` são ZERO — quem
  // faz o papel dos dois é `custoVenda`, e aplicar os três contaria a corretagem
  // duas vezes sobre o mesmo negócio.
  const receitaAluguel = soma(meses.map((x) => x.rentalRevenue));
  const receitaBruta = ehLocacao ? receitaAluguel + valorSaida : vgv;
  const comissoes = ehLocacao ? 0 : vgv * (rec.comissaoPct || 0);
  const cartorio = ehLocacao ? 0 : vgv * (rec.custoCartorioPct || 0);
  const custoVenda = ehLocacao ? valorSaida * (loc.custoVendaPct || 0) : 0;
  const receitaLiquida = receitaBruta - comissoes - cartorio - custoVenda;
  const lucroProjeto = receitaLiquida - custoEmpreendimento - custoFinanceiro;
  const lucroInvestidores = lucroProjeto * (rec.lucroInvestidoresPct || 0);
  const lucroSponsor = lucroProjeto * (rec.lucroSponsorPct || 0);
  const equityTotal = soma(meses.map((x) => x.equityCall));
  // Inclui o saque destinado à reserva de juros: é principal sacado do
  // empréstimo como qualquer outro, rende juros e volta pela amortização. Com
  // reserva 0 o termo some e o número é o de sempre.
  const dividaSacada = soma(meses.map((x) => x.draw + x.saqueReservaJuros));
  const dividaAmortizada = soma(meses.map((x) => x.amortization));
  // Pico do saldo devedor: a grandeza que um contrato ROTATIVO limita. Numa
  // linha não rotativa quem manda é o total desembolsado (`dividaSacada`), e os
  // dois só coincidem quando nada é amortizado antes do fim.
  const saldoDevedorMaximo = meses.length ? Math.max(...meses.map((x) => x.saldoDevedor)) : 0;
  // A base sobre a qual o fee de fato incidiu, resolvida com o MESMO pico da
  // passada convergida — é literalmente o número que multiplicou o percentual.
  // Sai daqui para a conferência e para a leitura da aba Financiamento em vez de
  // ser recomputado nas duas, que é como as três contas divergiriam.
  // Base do fee de CADA facilidade, resolvida com o pico DELA na passada
  // convergida — é literalmente o número que multiplicou cada percentual. O
  // campo da apuração é a soma, e com uma facilidade é o valor de sempre.
  const picoPorFacilidadeFinal = facilidades.map((_, i) =>
    meses.length
      ? Math.max(
          0,
          ...meses.map((x) => x.porFacilidade.find((f) => f.indice === i)?.saldoDevedor ?? 0),
        )
      : 0,
  );
  const basePorFacilidade = ctxFacilidades.map((c, i) =>
    c.ativa ? c.baseFee(picoPorFacilidadeFinal[i]) : 0,
  );
  const baseFee = soma(basePorFacilidade);
  const totalPagamentos = soma(meses.map((x) => x.pagamentos));
  const totalDistribuido = equityTotal + lucroInvestidores;

  // Custo de DESENVOLVIMENTO: o que custou pôr o ativo de pé, SEM o OPEX de
  // operá-lo. É o denominador de `yieldOnCost` e de `custoDesenvolvimentoPorSf`,
  // e está na apuração justamente para o spread sobre o cap ser auditável.
  // No modo venda `opexTotal` é zero e este é o mesmo numerador que
  // `custoPorUnidade` e `custoPorSf` sempre usaram.
  const custoDesenvolvimento = custoEmpreendimento - opexTotal + custoFinanceiro;

  const apuracao: Apuracao = {
    receitaBruta,
    comissoes,
    cartorio,
    custoVenda,
    receitaLiquida,
    receitaAluguel,
    opexTotal,
    // NOI ACUMULADO do fluxo. Não confundir com `Indicadores.noiEstabilizado`,
    // que é o NOI ANUAL de referência que divide o cap rate.
    noiTotal: receitaAluguel - opexTotal,
    custoTerrenos,
    custoObra,
    custoPropertyTax,
    custoOutros,
    custoEmpreendimento,
    custoDesenvolvimento,
    jurosTotais,
    feeTotal,
    custoFinanceiro,
    lucroProjeto,
    lucroInvestidores,
    lucroSponsor,
    equityTotal,
    dividaSacada,
    dividaAmortizada,
    saldoDevedorMaximo,
    baseFeeEstruturacao: baseFee,
    totalPagamentos,
    totalDistribuido,
    tetoDivida,
  };

  // ─── Indicadores ───────────────────────────────────────────────────────────
  const fluxoInvestidor = meses.map((x) => x.distribution - x.equityCall);
  // Mesmo mapa que alimenta o gatilho de custo 'por_venda' e o release price: as
  // três leituras saem daqui, então não têm como divergir.
  const unidadesVendidasPorMes = meses.map((x) => x.unidadesVendidas);
  const tir = tirMensal(fluxoInvestidor);
  const indicadores: Indicadores = {
    moic: razao(totalDistribuido, equityTotal),
    roi: razao(lucroInvestidores, equityTotal),
    margemVgv: razao(lucroProjeto, vgv),
    // LTC por DESEMBOLSO: total sacado sobre o custo direto. Fórmula intocada de
    // propósito — mudar o significado de um indicador já em uso quebraria a
    // comparação com toda modelagem antiga.
    ltc: razao(dividaSacada, terrenosTotal + obraTotal),
    // LTC de PICO: o maior saldo devedor sobre o mesmo custo direto. É o que um
    // covenant de linha rotativa cobra. Numa linha não rotativa sem amortização
    // antecipada os dois coincidem.
    ltcPico: razao(saldoDevedorMaximo, terrenosTotal + obraTotal),
    alavancagem: razao(dividaSacada, totalPagamentos),
    // Custo ACUMULADO da dívida sobre o principal sacado — não é taxa a.a.
    // Fórmula intocada de propósito, pelo mesmo motivo do `ltc`: mudar o
    // significado de um número já em uso quebra a comparação com modelagens
    // antigas.
    custoTotalDividaPct: razao(custoFinanceiro, dividaSacada),
    // Custo acumulado da dívida sobre o PICO do saldo devedor. Mesma relação que
    // `ltcPico` tem com `ltc`: numa linha rotativa o total desembolsado é um
    // múltiplo da exposição real, e dividir por ele SUBESTIMA o custo da dívida.
    // Sem amortização antes do fim os dois coincidem.
    custoTotalDividaPicoPct: razao(custoFinanceiro, saldoDevedorMaximo),
    tirMensal: tir,
    tirAnual: anualizar(tir),
    xirr: xirr(fluxoInvestidor, meses.map((x) => x.data)),
    // Uma pro forma mostra custo por lote em toda linha do orçamento, e o custo
    // total por unidade contra o preço de venda. Tudo aqui é derivação pura do
    // que já foi apurado — `razao` devolve null em denominador zero, então nunca
    // sai NaN nem Infinity para a tela.
    //
    // O numerador do custo é `custoEmpreendimento + custoFinanceiro`, e não só o
    // custo do empreendimento: o que interessa a quem decide é o custo TUDO
    // INCLUÍDO da unidade, comparável com o preço de venda.
    custoPorUnidade: razao(custoEmpreendimento + custoFinanceiro, unidadesTotal),
    custoPorSf: razao(custoEmpreendimento + custoFinanceiro, bases.areaSf),
    precoMedioPorUnidade: razao(vgv, unidadesTotal),
    receitaPorSf: razao(vgv, bases.areaSf),
    margemPorUnidade: razao(lucroProjeto, unidadesTotal),

    // ─── Modo locação ────────────────────────────────────────────────────────
    // TODOS `null` no modo venda, sem exceção. Devolver zero faria a tela
    // mostrar "0,00%" de yield on cost num projeto que não tem yield nenhum — e
    // um zero é indistinguível de um cálculo que deu zero de verdade.
    noiEstabilizado: ehLocacao ? noiReferencia : null,
    // Já resolvido lá em cima, com a guarda `capRate > 0`: cap rate zero é
    // valor de saída ZERO, nunca Infinity.
    valorSaida: ehLocacao ? valorSaida : null,
    // Denominador é o custo de DESENVOLVIMENTO, sem o OPEX da operação — ver o
    // comentário do campo em tipos.ts. `razao` devolve null em denominador zero,
    // então nunca sai NaN nem Infinity para a tela.
    yieldOnCost: ehLocacao ? razao(noiReferencia, custoDesenvolvimento) : null,
    // O SPREAD SOBRE O CAP É O NEGÓCIO INTEIRO: o que o ativo rende sobre o
    // custo, menos o que o comprador exige. Negativo não é erro do modelo — é um
    // projeto que vale menos do que custou, e é justamente isso que o modelo
    // existe para revelar (`spread_negativo` acende âmbar, não vermelho).
    //
    // `null` quando o yield não existe: um spread calculado sobre denominador
    // zero seria `−capRate`, um número plausível e completamente falso.
    spreadSobreCap: ehLocacao
      ? (() => {
          const y = razao(noiReferencia, custoDesenvolvimento);
          return y === null ? null : y - (loc.capRateSaida || 0);
        })()
      : null,
    aluguelPorSf: ehLocacao ? razao(receitaBrutaAnual100, bases.areaSf) : null,
    custoDesenvolvimentoPorSf: ehLocacao ? razao(custoDesenvolvimento, bases.areaSf) : null,
    // ─── Os dois breakevens de ocupação ──────────────────────────────────────
    //
    // A ocupação entra na conta do NOI em DOIS lugares e com sinais opostos: ela
    // multiplica a receita e multiplica o reembolso. Isolando-a:
    //
    //   NOI(o) = o × [receita100 × (1 − perdaCrédito) + opexReembolsável × taxa]
    //            − opexBruto
    //
    // O colchete é o ganho marginal por ponto de ocupação — receita mais
    // reembolso — e é o denominador dos dois breakevens. Zerado (sem aluguel e
    // sem reembolso), não há ocupação que cubra despesa nenhuma: `razao` devolve
    // null e a tela mostra "n/d", em vez de um Infinity.
    ocupacaoBreakevenNoi: ehLocacao
      ? razao(
          opexBrutoAnual,
          receitaBrutaAnual100 * (1 - (loc.perdaCreditoPct || 0)) +
            opexBrutoReembolsavelAnual * (loc.taxaReembolsoPct || 0),
        )
      : null,
    // Mesmo denominador, numerador acrescido dos juros ANUAIS: é o breakeven que
    // o banco olha, e é sempre maior que o do NOI. Os juros anuais saem do juro
    // total do projeto rateado pelo prazo — não de uma taxa aplicada ao saldo
    // final, que ignoraria a curva de saque inteira.
    ocupacaoBreakevenJuros: ehLocacao
      ? razao(
          opexBrutoAnual + (prazoTotal > 0 ? (jurosTotais / prazoTotal) * 12 : 0),
          receitaBrutaAnual100 * (1 - (loc.perdaCreditoPct || 0)) +
            opexBrutoReembolsavelAnual * (loc.taxaReembolsoPct || 0),
        )
      : null,
  };

  // ─── Rateio por sócio ──────────────────────────────────────────────────────
  //
  // ATENÇÃO, E ISTO É O QUE MAIS IMPORTA NESTE BLOCO: ISTO NÃO É PREFERRED
  // RETURN, NÃO É CATCH-UP E NÃO É PROMOTE. É DEVOLUÇÃO DE CAPITAL SEGUIDA DE
  // LUCRO POR PARTICIPAÇÃO — DUAS CAMADAS, NADA MAIS. UM WATERFALL DE VERDADE
  // (HURDLE, TIERS, PROMOTE DO SPONSOR) É OUTRO PROJETO. QUEM LER ESTE CÓDIGO
  // ACHANDO QUE JÁ TEM UM WATERFALL VAI PROMETER AO INVESTIDOR UM RETORNO QUE O
  // MODELO NÃO CALCULA.
  //
  // Duas grandezas, e a confusão entre elas é o erro clássico:
  //   `participacaoPct` governa o LUCRO;
  //   `pctCapital` (ou o cronograma do sócio) governa o CAPITAL.
  // Na regra 'participacao' as duas coincidem, e é por isso que o resultado de
  // toda modelagem já gravada não muda: `pctCapital` cai em `participacaoPct` e
  // `chamadasPorMes` volta a ser exatamente `p × equityCall`.

  /**
   * Fração efetiva do capital de cada sócio.
   *
   * Em 'cronograma_socio' não existe fração declarada: ela é DERIVADA do que o
   * sócio de fato aportou. `razao` devolve null em denominador zero e aqui isso
   * vira 0 — um NaN escapando daqui contaminaria capital, MOIC, ROI e TIR de
   * todos os sócios em silêncio.
   */
  const capitalDoSocio = socios.map((s, i) =>
    regraCapital === 'cronograma_socio'
      ? soma(meses.map((x) => aporteDoSocioPorMes[i].get(x.mes) ?? 0))
      : 0,
  );
  const fracaoCapital = socios.map((s, i) => {
    if (regraCapital === 'cronograma_socio') {
      return razao(capitalDoSocio[i], equityTotal) ?? 0;
    }
    if (regraCapital === 'pct_capital') {
      // `null` = "usa a participação"; `0` = "não põe capital nenhum". A
      // distinção é a razão de `pctCapital` ser nullable no banco.
      return s.pctCapital ?? s.participacaoPct ?? 0;
    }
    return s.participacaoPct || 0;
  });

  /**
   * Aporte REAL de cada sócio em cada mês.
   *
   * Identidade que o teste cobra: para todo mês, Σ chamadas de todos os sócios é
   * exatamente `meses[m].equityCall`. Em 'cronograma_socio' isso vale por
   * construção — o equity do mês É a soma dos aportes. Nas outras duas vale
   * quando as frações somam 1, que é o que `soma_participacoes` e
   * `soma_pct_capital` exigem em vermelho, bloqueando o salvamento.
   */
  const chamadasPorSocio = socios.map((s, i) =>
    regraCapital === 'cronograma_socio'
      ? meses.map((x) => aporteDoSocioPorMes[i].get(x.mes) ?? 0)
      : meses.map((x) => fracaoCapital[i] * x.equityCall),
  );

  // ─── Devolução, mês a mês, em duas camadas ─────────────────────────────────
  // 1ª camada: devolução de CAPITAL, pro-rata ao capital ainda não devolvido de
  //            cada sócio NAQUELE momento — não ao capital total do projeto. Um
  //            sócio que só entra no mês 20 não pode ser reembolsado no mês 10 de
  //            um dinheiro que ainda não pôs.
  // 2ª camada: o que sobra da distribuição do mês vai para o LUCRO, repartido por
  //            `participacaoPct`.
  //
  // O aporte do mês entra no saldo ANTES da distribuição do mesmo mês: o dinheiro
  // já está na conta do projeto quando a distribuição é calculada.
  const devolucoesPorSocio = socios.map(() => meses.map(() => 0));
  const lucroRecebido = socios.map(() => 0);
  {
    // Saldo de capital a devolver, por sócio, caminhando no tempo.
    const saldo = socios.map(() => 0);
    for (let k = 0; k < meses.length; k++) {
      for (let i = 0; i < socios.length; i++) saldo[i] += chamadasPorSocio[i][k];

      const disponivel = meses[k].distribution;
      if (disponivel <= 0 || socios.length === 0) continue;

      const saldoTotal = soma(saldo);
      const pagoCapital = Math.min(disponivel, saldoTotal);
      if (pagoCapital > 0 && saldoTotal > 0) {
        for (let i = 0; i < socios.length; i++) {
          const parte = (pagoCapital * saldo[i]) / saldoTotal;
          saldo[i] -= parte;
          devolucoesPorSocio[i][k] += parte;
        }
      }

      // Sobra = lucro do mês. Repartido por PARTICIPAÇÃO, não por capital: é a
      // outra grandeza, e é exatamente aqui que a distinção aparece no dinheiro.
      //
      // Sem normalizar por Σ participação de propósito: se as participações não
      // somam 100%, a fatia que sobra não é de ninguém, e é isso que
      // `soma_participacoes` acusa em vermelho — inventar um dono aqui esconderia
      // o erro em vez de mostrá-lo.
      const sobra = disponivel - pagoCapital;
      if (sobra > 0) {
        for (let i = 0; i < socios.length; i++) {
          const parte = sobra * (socios[i].participacaoPct || 0);
          lucroRecebido[i] += parte;
          devolucoesPorSocio[i][k] += parte;
        }
      }
    }
  }

  const rateioSocios: RateioSocio[] = socios.map((s, i) => {
    const chamadas = chamadasPorSocio[i];
    const devolucoes = devolucoesPorSocio[i];
    const capital = soma(chamadas);
    const total = soma(devolucoes);
    // O fluxo DELE: o que recebeu menos o que pôs, mês a mês. É daqui que sai a
    // TIR individual — e é por isso que dois sócios com o mesmo capital em datas
    // diferentes têm TIRs diferentes, coisa que o rateio pro-rata não mostrava.
    const fluxo = devolucoes.map((v, k) => v - chamadas[k]);
    // Capital zero devolve null em tudo: `razao` e `tirMensal` já garantem isso,
    // e é o que impede Infinity e NaN de chegarem à tela.
    const tirDele = tirMensal(fluxo);
    return {
      nome: s.nome,
      participacaoPct: s.participacaoPct || 0,
      cotaDisponivel: !!s.cotaDisponivel,
      pctCapital: fracaoCapital[i],
      capital,
      lucro: lucroRecebido[i],
      total,
      chamadasPorMes: chamadas,
      devolucoesPorMes: devolucoes,
      fluxoPorMes: fluxo,
      moic: razao(total, capital),
      roi: razao(lucroRecebido[i], capital),
      tirMensal: tirDele,
      tirAnual: anualizar(tirDele),
      xirr: xirr(fluxo, meses.map((x) => x.data)),
    };
  });

  // ─── Resultado por unidade ─────────────────────────────────────────────────
  // Rateio pro-rata pelo custo direto. Os custos que não pertencem a nenhuma
  // unidade (contingência, property tax, juros e fee) entram por esse fator, o
  // que garante Σ lucro das unidades = lucro do projeto.
  const compartilhado = custoEmpreendimento - custoDiretoInput + custoFinanceiro;
  const resultadoUnidades: ResultadoUnidade[] = unidades.map((u) => {
    const n = qtd(u);
    // Custo direto e receita da TIPOLOGIA inteira. Como custoDiretoInput também
    // já está multiplicado, o fatorRateio continua sendo uma fração do total e a
    // identidade Σ lucro das tipologias = lucro do projeto segue valendo.
    const custoDireto = ((u.custoTerreno || 0) + (u.custoObra || 0)) * n;
    const fatorRateio =
      custoDiretoInput > 0 ? custoDireto / custoDiretoInput : unidades.length > 0 ? 1 / unidades.length : 0;
    const custosCompartilhados = fatorRateio * (custoPropertyTax + custoOutros);
    const custoFinanceiroUnidade = fatorRateio * custoFinanceiro;
    /**
     * Receita líquida DESTA tipologia.
     *
     * Venda: preço × quantidade × fator líquido — a receita é da unidade, e cada
     * uma tem a sua.
     *
     * Locação: a receita NÃO é da tipologia. O aluguel é dela, mas o valor de
     * saída é do ATIVO INTEIRO — ninguém vende meio galpão a um fundo —, e o
     * cap rate se aplica ao NOI consolidado. Então a receita líquida do projeto
     * é rateada pela ÁREA LOCÁVEL, que é a grandeza que produz tanto o aluguel
     * quanto o valor de saída.
     *
     * Ler `precoVenda` aqui seria o erro silencioso clássico: o campo é IGNORADO
     * pelo motor no modo locação (o valor de saída vem do cap rate), então a
     * tabela por tipologia mostraria receita zero — ou, pior, uma receita que
     * não existe em conta nenhuma — e Σ lucro das tipologias deixaria de bater
     * com o lucro do projeto, que é a identidade que este bloco existe para
     * manter.
     *
     * Sem área declarada em tipologia nenhuma o denominador é zero: cai no
     * `fatorRateio` do custo direto, que é a única outra fração disponível e
     * também soma 1.
     */
    const receitaLiquidaUnidade = ehLocacao
      ? receitaLiquida *
        (bases.areaSf > 0 ? ((u.areaSf || 0) * n) / bases.areaSf : fatorRateio)
      : (u.precoVenda || 0) * n * fatorLiquido;
    const extraRateado =
      fatorRateio * (custoEmpreendimento - custoDiretoInput - custoPropertyTax - custoOutros);
    const custoTotal =
      custoDireto + custosCompartilhados + custoFinanceiroUnidade + extraRateado;
    const lucro = receitaLiquidaUnidade - custoTotal;
    return {
      nome: u.nome,
      quantidade: n,
      custoTerreno: (u.custoTerreno || 0) * n,
      custoObra: (u.custoObra || 0) * n,
      custoDireto,
      fatorRateio,
      custosCompartilhados: custosCompartilhados + extraRateado,
      custoFinanceiro: custoFinanceiroUnidade,
      custoTotal,
      custoTotalUnitario: custoTotal / n,
      receitaLiquida: receitaLiquidaUnidade,
      receitaLiquidaUnitaria: receitaLiquidaUnidade / n,
      lucro,
      margem: razao(lucro, receitaLiquidaUnidade),
    };
  });

  const conferencias: Conferencia[] = montarConferencias({
    input,
    cronograma,
    agregados,
    meses,
    apuracao,
    convergiu,
    orfaos,
    compartilhado,
    bases,
    resolucao,
    lancadoPorCusto,
    vendasPorMes,
    releaseTotal,
    rateioSocios,
    mesesNoTeto,
    descobertoPorTeto,
    releaseCortadoTotal,
    // ─── Locação e múltiplas facilidades ───────────────────────────────────
    // Tudo já resolvido, nada recalculado do outro lado: a conferência tem de
    // cobrar exatamente o número que o cálculo usou.
    tipoModelagem,
    facilidades,
    tetoPorFacilidade: ctxFacilidades.map((c) => c.teto),
    emCicloRefin,
    refinanciamentoDescoberto,
    noiReferencia,
    valorSaida,
    opexBrutoAnual,
    indicadores,
  });

  return {
    cronograma,
    agregados,
    meses,
    apuracao,
    indicadores,
    rateioSocios,
    resultadoUnidades,
    conferencias,
    fluxoInvestidor,
    unidadesVendidasPorMes,
    detalhamentoCustos,
    iteracoes,
    convergiu,
    overridesOrfaos: orfaos,
    celulasManuais: ativos.size,
  };
}
