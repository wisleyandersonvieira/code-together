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
 *   1. o fee de estruturação depende do TOTAL sacado;
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
  ConvencaoJuros,
  Conferencia,
  CustoAdicional,
  Cronograma,
  DetalheCusto,
  FaseCronograma,
  Indicadores,
  LinhaFluxo,
  MesFluxo,
  ModelInput,
  ModelOutput,
  Override,
  RateioSocio,
  RegraRateioCapital,
  ResultadoUnidade,
  Unidade,
} from './tipos';
import { CATEGORIAS_CUSTO } from './tipos';
import { montarConferencias } from './conferencias';
import { anualizar, diasDoMes, indiceMes, razao, somarMeses, tirMensal, xirr } from './indicadores';

const MAX_ITERACOES = 50;
const TOL_CONVERGENCIA = 0.01;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const chave = (mes: number, linha: LinhaFluxo) => `${mes}:${linha}`;

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
  feeTotal: number;
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
}

export function calcular(input: ModelInput): ModelOutput {
  const fin = input.financiamento;
  const rec = input.receita;
  const unidades = input.unidades ?? [];
  const custosAdicionais = input.custosAdicionais ?? [];
  const socios = input.socios ?? [];

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
  };

  // ─── Overrides ─────────────────────────────────────────────────────────────
  // Overrides fora do prazo NÃO são apagados: ficam inativos, acendem conferência
  // e voltam a valer se o prazo aumentar de novo.
  const ativos = new Map<string, number | null>();
  const orfaos: Override[] = [];
  for (const o of input.overrides ?? []) {
    if (!Number.isInteger(o.mes) || o.mes < 1 || o.mes > prazoTotal) {
      orfaos.push(o);
      continue;
    }
    ativos.set(chave(o.mes, o.linha), o.limpar ? null : (o.valor ?? 0));
  }
  const temOverride = (m: number, l: LinhaFluxo) => ativos.has(chave(m, l));
  // `null` (célula forçada a vazio) não contribui com nada na aritmética, mas
  // continua distinta de zero para a interface.
  const valorOverride = (m: number, l: LinhaFluxo) => ativos.get(chave(m, l)) ?? 0;

  // ─── Linhas de custo e receita (não dependem da iteração) ──────────────────
  const zeros = () => new Array<number>(prazoTotal + 1).fill(0);
  const land = zeros();
  const construction = zeros();
  const propertyTax = zeros();
  const otherCosts = zeros();
  const revenue = zeros();

  const mesesConstrucao = Math.trunc(input.mesesConstrucao);
  const fatorLiquido = 1 - (rec.comissaoPct || 0) - (rec.custoCartorioPct || 0);

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
    propertyTax[m] = taxAnoTotal / 12;
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
  if (rec.modoVenda === 'single_exit') {
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

  if (rec.modoVenda === 'single_exit') {
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

  for (let m = 1; m <= prazoTotal; m++) {
    if (temOverride(m, 'land')) land[m] = valorOverride(m, 'land');
    if (temOverride(m, 'construction')) construction[m] = valorOverride(m, 'construction');
    if (temOverride(m, 'property_tax')) propertyTax[m] = valorOverride(m, 'property_tax');
    if (temOverride(m, 'other_costs')) otherCosts[m] = valorOverride(m, 'other_costs');
    if (temOverride(m, 'revenue')) revenue[m] = valorOverride(m, 'revenue');
  }

  // ─── Teto de dívida ────────────────────────────────────────────────────────
  const tetoDivida =
    fin.valorContratado != null
      ? fin.valorContratado
      : fin.maxLtcPct != null
        ? fin.maxLtcPct * (terrenosTotal + obraTotal)
        : Number.POSITIVE_INFINITY;

  const colchao = fin.colchaoMinimoCaixa || 0;

  // ─── Taxa efetiva do mês ───────────────────────────────────────────────────
  // Com taxa fixa é `taxaAnual`, constante, e o resultado é o de sempre. Com taxa
  // variável é (curva do benchmark naquele mês, ou o padrão) + spread — e mês sem
  // ponto na curva NÃO é benchmark zero: cai no padrão, e a conferência
  // `benchmark_incompleto` diz quantos meses caíram nele.
  const convencao: ConvencaoJuros = fin.convencaoJuros ?? 'mensal_12';
  const curvaBenchmark = new Map<number, number>();
  for (const p of fin.benchmarkCurva ?? []) {
    if (Number.isInteger(p.mes) && p.mes >= 1) curvaBenchmark.set(p.mes, p.valor || 0);
  }
  const taxaEfetivaDoMes = (m: number) =>
    fin.tipoTaxa === 'variavel'
      ? (curvaBenchmark.get(m) ?? fin.benchmarkPadrao ?? 0) + (fin.spread || 0)
      : fin.taxaAnual || 0;

  // ─── Reserva de juros ──────────────────────────────────────────────────────
  const reservaJuros = Math.max(0, fin.reservaJuros || 0);
  const reservaSacada = fin.reservaJurosSacada !== false;

  // ─── Amortização: só release e quitação na saída ───────────────────────────
  // Sobraram DOIS modos, e o passo 3 é a implementação inteira dos dois:
  //   'at_exit' — o saldo remanescente sai no mês da saída;
  //   'manual'  — nada automático, só overrides.
  // O release por unidade vendida amortiza nos dois, porque não é modo: é
  // cláusula do contrato.
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

  // ─── Release price ─────────────────────────────────────────────────────────
  // Valor fixo tem precedência sobre o percentual — ver o COMMENT da coluna. O
  // percentual incide sobre o preço BRUTO das unidades que fecham no mês, não
  // sobre a receita líquida: é assim que o contrato é escrito, e a comissão do
  // corretor não reduz o que o banco leva.
  //
  // Alvo PRETENDIDO do mês, antes de qualquer teto. É a ÚNICA fonte do release:
  // a previsão do passo 1, a amortização do passo 3 e o total que a conferência
  // examina saem todos daqui, e por isso não têm como divergir. `vendasPorMes` é
  // a mesma série que alimenta o gatilho de custo 'por_venda' e
  // `MesFluxo.unidadesVendidas`.
  const releasePrice = Math.max(0, fin.releasePrice || 0);
  const releasePct = fin.releasePricePct ?? null;
  const releaseBrutoDoMes = (m: number, unidadesNoMes = vendasPorMes.get(m) ?? 0) => {
    if (releasePrice > 0) return releasePrice * unidadesNoMes;
    // Valor bruto REAL das unidades que fecham no mês, não o preço médio vezes a
    // contagem: com tipologias de preços diferentes a média cobraria release a
    // mais nas baratas e a menos nas caras. Num projeto de preço uniforme os
    // dois são o mesmo número.
    if (releasePct != null) return releasePct * (valorVendidoPorMes.get(m) ?? 0);
    return 0;
  };

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
  const passe = (estado: EstadoPonto): ResultadoPasse => {
    const meses: MesFluxo[] = [];
    // Quanto da demanda do mês o TETO impediu de sacar, acumulado no passe
    // inteiro. Alimenta `teto_divida`, que só assim consegue dizer quanto de
    // aporte a mais fecharia o caixa.
    let mesesNoTeto = 0;
    let descobertoPorTeto = 0;
    let saldoAnterior = 0;
    let caixaAcumulado = 0;
    let obraAcumulada = 0;
    let sacadoAte = 0;
    let equityAcumulado = 0;
    let jaHouveSaque = false;
    let saldoReserva = 0;
    // Release que o teto do saldo de abertura cortou, somado no passe inteiro.
    // Alimenta `release_insuficiente`: é dívida que as vendas queriam quitar e
    // não havia mais.
    let releaseCortadoTotal = 0;

    for (let m = 1; m <= prazoTotal; m++) {
      const pagamentosOperacionais = land[m] + construction[m] + propertyTax[m] + otherCosts[m];
      const saldoAbertura = saldoAnterior;
      const caixaAbertura = caixaAcumulado;
      obraAcumulada += construction[m];

      // Capacidade de saque do mês.
      //
      // Linha ROTATIVA (migration 1763300000): amortizar devolve limite, então o
      // que importa é a POSIÇÃO EM ABERTO, não o total já desembolsado na vida
      // do empréstimo. Não rotativa (default, e toda modelagem já gravada): o
      // teto vale para o total desembolsado, e capacidade consumida não volta.
      //
      // Nos dois casos a base é o saldo de ABERTURA, nunca o saldo depois do
      // saque ou depois da amortização do próprio mês. Duas razões:
      //   1. o saldo pós-saque depende do saque, e o saque dependeria do saldo —
      //      é a mesma circularidade que o teto do release cria (ver abaixo), e
      //      ela empurra o ponto fixo sem convergir para caixa fechado;
      //   2. contratualmente o pedido de saque é avaliado contra a posição em
      //      aberto NO MOMENTO DO PEDIDO, não contra a posição depois da
      //      liquidação da venda do mesmo mês. É a leitura conservadora e a
      //      única autoconsistente.
      const capacidade = fin.linhaRotativa
        ? Math.max(0, tetoDivida - saldoAbertura)
        : Math.max(0, tetoDivida - sacadoAte);
      const dentroJanela = m >= fin.mesInicioSaque && m <= fin.mesFimSaque;

      // Taxa e fator do mês, apurados ANTES do passo 1 porque o teto do release
      // precisa dos juros previstos sobre o saldo de abertura. Dependem só de `m`
      // e do contrato — não do saque —, então subi-los não muda número nenhum.
      const taxaEfetivaAno = taxaEfetivaDoMes(m);
      const fatorMes = fatorJurosDoMes(convencao, taxaEfetivaAno, somarMeses(input.dataInicio, m - 1));

      // ─── Release do mês ────────────────────────────────────────────────────
      // Unidades que fecham no mês — a mesma série que alimenta o gatilho de
      // custo 'por_venda' e `MesFluxo.unidadesVendidas`. Uma fonte só, para as
      // leituras não divergirem.
      const unidadesNoMes = vendasPorMes.get(m) ?? 0;
      const releaseBruto = releaseBrutoDoMes(m, unidadesNoMes);

      // TETO PELO SALDO DE ABERTURA, não pelo saldo depois do saque do mês.
      // Sem isto, cada dólar sacado libera um dólar a mais de amortização, o
      // caixa nunca melhora e o ponto fixo empurra o saque para cima sem
      // convergir para um caixa fechado. Ninguém toma emprestado hoje para
      // amortizar hoje o mesmo empréstimo — e o motor não pode modelar isso.
      const jurosPrevistosSobreAbertura = saldoAbertura * fatorMes;
      const tetoRelease = saldoAbertura + (fin.capitalizarJuros ? jurosPrevistosSobreAbertura : 0);
      const alvoRelease = clamp(releaseBruto, 0, tetoRelease);
      // O que o teto cortou: a venda queria quitar mais do que ainda se devia.
      releaseCortadoTotal += Math.max(0, releaseBruto - alvoRelease);

      // 1. SAQUE — vem antes da amortização, porque no modo at_exit a amortização
      //    precisa conhecer o saque do próprio mês. Para não fechar o círculo no
      //    cash_demand, o saque usa uma amortização PREVISTA (só o saldo de
      //    abertura), não a definitiva.
      //
      //    O release ENTRA na previsão: é saída de caixa do mês como qualquer
      //    amortização, e deixá-lo de fora era o que fazia o saque ser
      //    dimensionado a menos e o caixa fechar negativo justamente nos meses de
      //    venda. `alvoRelease` é o mesmo número que o passo 3 vai amortizar —
      //    previsão e realização não podem divergir, senão o dinheiro sacado não
      //    chega inteiro ao caixa.
      //
      //    max(0, saldoAbertura − alvoRelease) evita a soma dupla: no mês da
      //    saída, o que o release já amortiza não precisa ser pedido de novo. Sem
      //    isso o motor pede o dobro e o saque sai inflado no último mês.
      const amortPrevista =
        alvoRelease +
        (fin.modoAmortizacao === 'at_exit' && m === mesSaida
          ? Math.max(0, saldoAbertura - alvoRelease)
          : 0);

      // Demanda de caixa do mês, nas duas leituras que os modos usam. Calculadas
      // aqui em cima, fora do if, é o que garante que a tela mostre a MESMA conta
      // que dimensionou o saque — recomputá-la depois abriria espaço para as duas
      // divergirem.
      //
      // `custoFinEstimado` vem do ponto fixo: é o custo financeiro que a passada
      // anterior apurou para ESTE mês. Com a flag desligada é zero, e aí os juros
      // do mês saem do caixa sem ter entrado no dimensionamento.
      const custoFinEstimado = fin.custoFinanceiroNaDemanda ? (estado.custoFinPorMes[m] ?? 0) : 0;
      const demandaSemAporte =
        pagamentosOperacionais + custoFinEstimado + amortPrevista + colchao - revenue[m] - caixaAbertura;
      const demandaLiquidaDeAporte = demandaSemAporte - aportePrevisto[m];

      let draw: number;
      // A demanda que DIMENSIONOU o saque neste mês. Nos modos que não
      // dimensionam por demanda ela é só leitura da aba Demanda de Caixa.
      let demandaDoSaque = demandaLiquidaDeAporte;
      if (temOverride(m, 'draw')) {
        // Override de saque vence sempre, inclusive acima do teto: nesse caso a
        // conferência acende vermelho, mas o cálculo segue.
        draw = valorOverride(m, 'draw');
      } else if (fin.modoSaque === 'equity_first') {
        // Regra clássica: o capital próprio entra primeiro na obra. Só há saque
        // depois que a obra acumulada ultrapassa o equity disponível para obra.
        //
        // O teto `construction[m]` é o que deixa terreno, property tax, custos do
        // orçamento e custo financeiro sem cobertura de dívida — e é exatamente
        // isso que o modo 'equity_first_demanda' abaixo resolve. Aqui não se
        // mexe: é o resultado de toda modelagem já gravada.
        draw = dentroJanela
          ? clamp(obraAcumulada - equityDisponivelObraAte(m), 0, Math.min(construction[m], capacidade))
          : 0;
      } else if (fin.modoSaque === 'cash_demand') {
        // Dimensiona a dívida pela necessidade real de caixa do mês. Ignora o
        // aporte do próprio mês de propósito — ver o modo abaixo.
        demandaDoSaque = demandaSemAporte;
        draw = dentroJanela ? clamp(demandaSemAporte, 0, capacidade) : 0;
      } else if (fin.modoSaque === 'equity_first_demanda') {
        // O capital próprio entra primeiro porque é descontado da demanda: só
        // sobra saque quando o aporte do mês, a receita e o caixa de abertura não
        // cobrem os pagamentos mais o colchão.
        //
        // Diferente do 'cash_demand', que ignora o aporte do próprio mês e por
        // isso saca no mês 1 mesmo quando o aporte já cobriria tudo — deixando
        // dinheiro parado em caixa pagando juros.
        //
        // clamp(…, 0, capacidade): mês superavitário não gera saque NEGATIVO (o
        // saque não é devolução de principal — quem devolve é a amortização), e o
        // teto continua sendo o teto. Quando a demanda passa da capacidade o
        // caixa fica negativo de novo — e é justamente isso que `teto_divida`
        // conta logo abaixo, com o valor de aporte que fecharia o buraco.
        //
        // Fora da janela de saque o saque é ZERO e o buraco fica. É correto:
        // janela é contrato, não preferência — o banco não libera dinheiro em mês
        // nenhum fora dela, e inventar saque ali esconderia um problema de
        // cronograma que `caixa_minimo` tem de mostrar.
        draw = dentroJanela ? clamp(demandaLiquidaDeAporte, 0, capacidade) : 0;
      } else {
        draw = 0; // 'manual' → só overrides
      }
      sacadoAte += draw;

      // Cobertura do mês, para a aba Demanda de Caixa não ter de recalcular nada.
      // O clamp no coberto: saque ACIMA da demanda — override, ou o saque do
      // equity_first quando a obra do mês passa da necessidade — sobra em caixa,
      // não é cobertura.
      const demandaDimensionada = Math.max(0, demandaDoSaque);
      const demandaCoberta = clamp(draw, 0, demandaDimensionada);
      const demandaDescoberta = Math.max(0, demandaDimensionada - draw);

      // O teto BINDOU neste mês: havia demanda, o mês estava dentro da janela e a
      // capacidade foi o limite. Contado só no modo novo — nos outros o saque não
      // é dimensionado por esta demanda, e contá-los mudaria o texto de
      // `teto_divida` em modelagem já gravada.
      if (
        fin.modoSaque === 'equity_first_demanda' &&
        !temOverride(m, 'draw') &&
        dentroJanela &&
        demandaDoSaque > capacidade + TOL_CONVERGENCIA
      ) {
        mesesNoTeto += 1;
        descobertoPorTeto += demandaDoSaque - draw;
      }

      // 1b. RESERVA DE JUROS — constituída no PRIMEIRO SAQUE, um único mês.
      //     Sacada: sai do próprio empréstimo, soma ao principal e rende juros
      //     como qualquer principal, mas NÃO passa pelo caixa do projeto (o
      //     dinheiro vai direto para a conta da reserva). Orçamentária: só abre o
      //     saldo, sem mexer em dívida nem em chamada de capital.
      const ehPrimeiroSaque = !jaHouveSaque && draw > 0;
      if (ehPrimeiroSaque) jaHouveSaque = true;
      const constituiReserva = ehPrimeiroSaque && reservaJuros > 0;
      const saqueReservaJuros = constituiReserva && reservaSacada ? reservaJuros : 0;
      if (constituiReserva) saldoReserva = reservaJuros;
      sacadoAte += saqueReservaJuros;

      // 2. JUROS — dependem só do saldo já sacado, então já podem ser apurados.
      //    `fatorMes` foi apurado antes do passo 1, para o teto do release.
      const saldoAntes = saldoAbertura + draw + saqueReservaJuros;
      const juros = saldoAntes * fatorMes;

      // 2b. A reserva paga PRIMEIRO, a capitalização vem DEPOIS. A ordem importa:
      //     invertida, o juro viraria principal antes de a reserva ter chance de
      //     absorvê-lo, e a reserva nunca esvaziaria. Os dois recursos coexistem —
      //     a reserva não substitui `capitalizarJuros`.
      const jurosPagosPelaReserva = Math.min(juros, saldoReserva);
      saldoReserva -= jurosPagosPelaReserva;
      const jurosAposReserva = juros - jurosPagosPelaReserva;

      // Com capitalização, o que sobrou vira principal ANTES da amortização; senão
      // o saldo final do mês de saída ficaria com um mês de juros pendurado.
      const baseAmortizavel = saldoAntes + (fin.capitalizarJuros ? jurosAposReserva : 0);

      // 3. AMORTIZAÇÃO — release do mês, mais a quitação no mês de saída.
      //
      //    `alvoRelease` NÃO é recalculado aqui: é exatamente o número que o
      //    passo 1 previu, já limitado pelo saldo de ABERTURA. Previsão e
      //    realização usando o mesmo número é o que faz o saque dimensionado
      //    chegar inteiro ao caixa — recalcular contra `baseAmortizavel` (que já
      //    contém o saque do mês) reabriria a circularidade.
      //
      //    max(0, baseAmortizavel − alvoRelease) no mês da saída: o release já
      //    amortizou uma parte, e o at_exit cobre só o remanescente.
      //
      //    O clamp final continua sendo a proteção contra saldo devedor negativo
      //    por override abusivo.
      let alvoAmort: number;
      if (temOverride(m, 'amortization')) {
        // Override vence tudo — inclusive o release.
        alvoAmort = valorOverride(m, 'amortization');
      } else {
        const parteExit =
          fin.modoAmortizacao === 'at_exit' && m === mesSaida
            ? Math.max(0, baseAmortizavel - alvoRelease)
            : 0;
        alvoAmort = alvoRelease + parteExit;
      }
      const amortization = clamp(alvoAmort, 0, baseAmortizavel);
      const saldoDevedor = baseAmortizavel - amortization;
      // Quanto da amortização do mês foi release, para a grade do fluxo poder
      // decompor "Release: X · Saída: Y" sem refazer a conta.
      const amortizacaoRelease = Math.min(amortization, alvoRelease);

      // 4. FEE
      const mesDoFee =
        fin.feeTiming === 'first_draw' ? ehPrimeiroSaque : m === fin.feeMes;
      const fee = mesDoFee ? estado.feeTotal : 0;

      // Juros capitalizados não saem do caixa (viram principal), mas continuam
      // na apuração de resultado como custo financeiro incorrido. O que a reserva
      // pagou também não sai do caixa — é isso que ela existe para fazer.
      const custoFinanceiroCaixa = (fin.capitalizarJuros ? 0 : jurosAposReserva) + fee;
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
          pagamentos + amortization + colchao - draw - revenue[m] - caixaAbertura,
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
      // principal (saldoAntes) e volta pela amortização, como qualquer dívida.
      const caixaMes =
        equityCall + draw + revenue[m] - pagamentos - amortization - distribution;
      caixaAcumulado += caixaMes;
      saldoAnterior = saldoDevedor;

      meses.push({
        mes: m,
        data: somarMeses(input.dataInicio, m - 1),
        land: land[m],
        construction: construction[m],
        propertyTax: propertyTax[m],
        otherCosts: otherCosts[m],
        pagamentosOperacionais,
        juros,
        jurosPagosPelaReserva,
        saldoReservaJuros: saldoReserva,
        fee,
        custoFinanceiroCaixa,
        pagamentos,
        revenue: revenue[m],
        draw,
        saqueReservaJuros,
        amortization,
        equityCall,
        distribution,
        saldoDevedor,
        equityAcumulado,
        caixaAbertura,
        caixaMes,
        caixaAcumulado,
        demandaBruta: pagamentos + amortization - revenue[m],
        demandaDimensionada,
        demandaCoberta,
        demandaDescoberta,
        amortizacaoPrevista: amortPrevista,
        amortizacaoRelease,
        capacidadeSaque: capacidade,
        taxaEfetivaAno,
        unidadesVendidas: vendasPorMes.get(m) ?? 0,
        equityDisponivelAcumulado: equityDisponivelObraAte(m),
      });
    }
    return { meses, mesesNoTeto, descobertoPorTeto, releaseCortadoTotal };
  };

  // ─── Ponto fixo ────────────────────────────────────────────────────────────
  let estado: EstadoPonto = {
    feeTotal: 0,
    custoFinPorMes: zeros(),
    distribuicaoAutomatica: 0,
  };
  let meses: MesFluxo[] = [];
  let mesesNoTeto = 0;
  let descobertoPorTeto = 0;
  let releaseCortadoTotal = 0;
  let iteracoes = 0;
  let convergiu = false;

  const custoDiretoInput = terrenosTotal + obraTotal;

  for (let it = 0; it < MAX_ITERACOES; it++) {
    iteracoes = it + 1;
    // O corte pelo teto vale o da ÚLTIMA passada, como todo o resto: é a passada
    // convergida que vira resultado.
    ({ meses, mesesNoTeto, descobertoPorTeto, releaseCortadoTotal } = passe(estado));

    // Inclui o saque destinado à reserva de juros: é principal sacado do
    // empréstimo como qualquer outro, rende juros e volta pela amortização. Com
    // reserva 0 o termo some e o número é o de sempre.
    const dividaSacada = soma(meses.map((x) => x.draw + x.saqueReservaJuros));
    const equityTotal = soma(meses.map((x) => x.equityCall));
    const jurosTotais = soma(meses.map((x) => x.juros));
    const feeLancado = soma(meses.map((x) => x.fee));
    const custoEmpreendimento = soma(
      meses.map((x) => x.land + x.construction + x.propertyTax + x.otherCosts),
    );
    const receitaLiquida = vgv * fatorLiquido;
    const lucroProjeto = receitaLiquida - custoEmpreendimento - (jurosTotais + feeLancado);
    const lucroInvestidores = lucroProjeto * (rec.lucroInvestidoresPct || 0);

    const novoFee = dividaSacada * (fin.feeEstruturacaoPct || 0);
    const novoCustoFin = zeros();
    for (const x of meses) novoCustoFin[x.mes] = x.custoFinanceiroCaixa;
    const novaDist = equityTotal + lucroInvestidores;

    let delta = Math.max(
      Math.abs(novoFee - estado.feeTotal),
      Math.abs(novaDist - estado.distribuicaoAutomatica),
    );
    for (let m = 1; m <= prazoTotal; m++) {
      delta = Math.max(delta, Math.abs(novoCustoFin[m] - estado.custoFinPorMes[m]));
    }

    estado = { feeTotal: novoFee, custoFinPorMes: novoCustoFin, distribuicaoAutomatica: novaDist };
    if (it > 0 && delta < TOL_CONVERGENCIA) {
      convergiu = true;
      break;
    }
  }

  // Release PRETENDIDO (antes do clamp pelo saldo): é ele que a conferência
  // compara com a dívida para dizer se os releases quitam o empréstimo.
  let releaseTotal = 0;
  for (let m = 1; m <= prazoTotal; m++) releaseTotal += releaseBrutoDoMes(m);

  // ─── Apuração ──────────────────────────────────────────────────────────────
  // Nunca calcule o lucro como "receita líquida − quitação da dívida − devolução
  // do equity": isso só fecha quando fontes e usos batem exatamente, e quebra no
  // modo manual.
  const custoTerrenos = soma(meses.map((x) => x.land));
  const custoObra = soma(meses.map((x) => x.construction));
  const custoPropertyTax = soma(meses.map((x) => x.propertyTax));
  const custoOutros = soma(meses.map((x) => x.otherCosts));
  const custoEmpreendimento = custoTerrenos + custoObra + custoPropertyTax + custoOutros;
  const jurosTotais = soma(meses.map((x) => x.juros));
  const feeTotal = soma(meses.map((x) => x.fee));
  const custoFinanceiro = jurosTotais + feeTotal;
  const receitaBruta = vgv;
  const comissoes = vgv * (rec.comissaoPct || 0);
  const cartorio = vgv * (rec.custoCartorioPct || 0);
  const receitaLiquida = receitaBruta - comissoes - cartorio;
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
  const totalPagamentos = soma(meses.map((x) => x.pagamentos));
  const totalDistribuido = equityTotal + lucroInvestidores;

  const apuracao: Apuracao = {
    receitaBruta,
    comissoes,
    cartorio,
    receitaLiquida,
    custoTerrenos,
    custoObra,
    custoPropertyTax,
    custoOutros,
    custoEmpreendimento,
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
    custoTotalDividaPct: razao(custoFinanceiro, dividaSacada),
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
    const receitaLiquidaUnidade = (u.precoVenda || 0) * n * fatorLiquido;
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
