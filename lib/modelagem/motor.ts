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
 *   2. no modo cash_demand o saque depende do caixa, que depende do custo
 *      financeiro, que depende do saque;
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
  Conferencia,
  CustoAdicional,
  Cronograma,
  FaseCronograma,
  Indicadores,
  LinhaFluxo,
  MesFluxo,
  ModelInput,
  ModelOutput,
  Override,
  RateioSocio,
  ResultadoUnidade,
  Unidade,
} from './tipos';
import { CATEGORIAS_CUSTO } from './tipos';
import { montarConferencias } from './conferencias';
import { anualizar, indiceMes, razao, somarMeses, tirMensal, xirr } from './indicadores';

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

interface EstadoPonto {
  feeTotal: number;
  /** Custo financeiro de caixa por mês, indexado de 1 a prazoTotal. */
  custoFinPorMes: number[];
  distribuicaoAutomatica: number;
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
    modoAporte === 'plano'
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
  const venderNoMes = (mes: number, n: number) => {
    if (!Number.isInteger(mes) || mes < 1 || mes > prazoTotal || n <= 0) return;
    vendasPorMes.set(mes, (vendasPorMes.get(mes) ?? 0) + n);
  };
  if (rec.modoVenda === 'single_exit') {
    // Saída única: todas as unidades fecham no mês da venda do projeto.
    venderNoMes(mesSaida, unidadesTotal);
  } else if (rec.modoVenda === 'per_unit') {
    for (const venda of rec.vendasPorUnidade ?? []) {
      const u = unidades[venda.unidadeIndex];
      if (u) venderNoMes(venda.mesVenda, qtd(u));
    }
  } else if (rec.modoVenda === 'takedown') {
    // Aqui o takedown deixa de ser hipótese e vira a fonte: cada lote fecha N
    // unidades no seu mês. Lote fora do prazo não é contado (nem lançado) — a
    // conferência `takedown_incompleto` acusa a unidade que sobrou.
    for (const t of rec.takedowns ?? []) {
      const u = unidades[t.unidadeIndex];
      if (u) venderNoMes(t.mes, Math.max(0, Math.trunc(t.quantidade || 0)));
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
  const lancar = (i: number, mes: number, valor: number) => {
    // `Number.isInteger` reproduz exatamente o comportamento anterior: o laço
    // antigo comparava `c.mesAncora === m` contra meses inteiros, então âncora
    // fracionária nunca casava e nada era lançado. Sem esta guarda, `mes = 5.5`
    // criaria uma propriedade solta no array — invisível no fluxo, mas contada
    // como lançada.
    if (!Number.isInteger(mes) || mes < 1 || mes > prazoTotal) return;
    otherCosts[mes] += valor;
    lancadoPorCusto[i] += valor;
  };

  for (let i = 0; i < custosAdicionais.length; i++) {
    const c = custosAdicionais[i];
    const valor = efetivoPorCusto[i];

    if (c.gatilho === 'inicio_obra') {
      lancar(i, mesInicioObra, valor);
    } else if (c.gatilho === 'fim_obra') {
      lancar(i, mesFimObra, valor);
    } else if (c.gatilho === 'mes_fixo') {
      // Sem mês âncora não há onde lançar. Não é erro: é conferência.
      if (c.mesAncora != null) lancar(i, c.mesAncora, valor);
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

  const taxaMensal = (fin.taxaAnual || 0) / 12;
  const colchao = fin.colchaoMinimoCaixa || 0;

  // ─── Uma passada do loop mensal ────────────────────────────────────────────
  const passe = (estado: EstadoPonto): MesFluxo[] => {
    const meses: MesFluxo[] = [];
    let saldoAnterior = 0;
    let caixaAcumulado = 0;
    let obraAcumulada = 0;
    let sacadoAte = 0;
    let equityAcumulado = 0;
    let jaHouveSaque = false;

    for (let m = 1; m <= prazoTotal; m++) {
      const pagamentosOperacionais = land[m] + construction[m] + propertyTax[m] + otherCosts[m];
      const saldoAbertura = saldoAnterior;
      const caixaAbertura = caixaAcumulado;
      obraAcumulada += construction[m];

      const capacidade = Math.max(0, tetoDivida - sacadoAte);
      const dentroJanela = m >= fin.mesInicioSaque && m <= fin.mesFimSaque;

      // 1. SAQUE — vem antes da amortização, porque no modo at_exit a amortização
      //    precisa conhecer o saque do próprio mês. Para não fechar o círculo no
      //    cash_demand, o saque usa uma amortização PREVISTA (só o saldo de
      //    abertura), não a definitiva.
      const amortPrevista =
        fin.modoAmortizacao === 'at_exit' && m === mesSaida ? saldoAbertura : 0;

      let draw: number;
      if (temOverride(m, 'draw')) {
        // Override de saque vence sempre, inclusive acima do teto: nesse caso a
        // conferência acende vermelho, mas o cálculo segue.
        draw = valorOverride(m, 'draw');
      } else if (fin.modoSaque === 'equity_first') {
        // Regra clássica: o capital próprio entra primeiro na obra. Só há saque
        // depois que a obra acumulada ultrapassa o equity disponível para obra.
        draw = dentroJanela
          ? clamp(obraAcumulada - equityDisponivelObraAte(m), 0, Math.min(construction[m], capacidade))
          : 0;
      } else if (fin.modoSaque === 'cash_demand') {
        // Dimensiona a dívida pela necessidade real de caixa do mês.
        const custoFinEstimado = fin.custoFinanceiroNaDemanda ? (estado.custoFinPorMes[m] ?? 0) : 0;
        const demanda =
          pagamentosOperacionais + custoFinEstimado + amortPrevista + colchao - revenue[m] - caixaAbertura;
        draw = dentroJanela ? clamp(demanda, 0, capacidade) : 0;
      } else {
        draw = 0; // 'manual' → só overrides
      }
      sacadoAte += draw;

      // 2. JUROS — dependem só do saldo já sacado, então já podem ser apurados.
      const saldoAntes = saldoAbertura + draw;
      const juros = saldoAntes * taxaMensal;
      // Com capitalização, os juros viram principal ANTES da amortização; senão
      // o saldo final do mês de saída ficaria com um mês de juros pendurado.
      const baseAmortizavel = saldoAntes + (fin.capitalizarJuros ? juros : 0);

      // 3. AMORTIZAÇÃO — o clamp impede saldo devedor negativo mesmo com override abusivo.
      let alvoAmort: number;
      if (temOverride(m, 'amortization')) alvoAmort = valorOverride(m, 'amortization');
      else if (fin.modoAmortizacao === 'at_exit') alvoAmort = m === mesSaida ? baseAmortizavel : 0;
      else alvoAmort = 0;
      const amortization = clamp(alvoAmort, 0, baseAmortizavel);
      const saldoDevedor = baseAmortizavel - amortization;

      // 4. FEE
      const ehPrimeiroSaque = !jaHouveSaque && draw > 0;
      if (ehPrimeiroSaque) jaHouveSaque = true;
      const mesDoFee =
        fin.feeTiming === 'first_draw' ? ehPrimeiroSaque : m === fin.feeMes;
      const fee = mesDoFee ? estado.feeTotal : 0;

      // Juros capitalizados não saem do caixa (viram principal), mas continuam
      // na apuração de resultado como custo financeiro incorrido.
      const custoFinanceiroCaixa = (fin.capitalizarJuros ? 0 : juros) + fee;
      const pagamentos = pagamentosOperacionais + custoFinanceiroCaixa;

      // 5. APORTE DE EQUITY — a receita do mês cobre os custos do próprio mês.
      //    No mês da venda isso significa que não há chamada de capital para
      //    pagar juros e property tax daquele mês: o dinheiro da venda já entrou.
      //    Precedência, nesta ordem: override manual, parcela do plano, resíduo.
      //    No modo 'plano' o mês sem parcela recebe ZERO e o caixa fica negativo
      //    se o plano não cobrir a demanda — é exatamente o que o usuário quer
      //    enxergar, e a conferência de caixa mínimo acusa.
      let equityCall: number;
      if (temOverride(m, 'equity_call')) {
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
        fee,
        custoFinanceiroCaixa,
        pagamentos,
        revenue: revenue[m],
        draw,
        amortization,
        equityCall,
        distribution,
        saldoDevedor,
        equityAcumulado,
        caixaAbertura,
        caixaMes,
        caixaAcumulado,
        demandaBruta: pagamentos + amortization - revenue[m],
        capacidadeSaque: capacidade,
        equityDisponivelAcumulado: equityDisponivelObraAte(m),
      });
    }
    return meses;
  };

  // ─── Ponto fixo ────────────────────────────────────────────────────────────
  let estado: EstadoPonto = {
    feeTotal: 0,
    custoFinPorMes: zeros(),
    distribuicaoAutomatica: 0,
  };
  let meses: MesFluxo[] = [];
  let iteracoes = 0;
  let convergiu = false;

  const custoDiretoInput = terrenosTotal + obraTotal;

  for (let it = 0; it < MAX_ITERACOES; it++) {
    iteracoes = it + 1;
    meses = passe(estado);

    const dividaSacada = soma(meses.map((x) => x.draw));
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
  const dividaSacada = soma(meses.map((x) => x.draw));
  const dividaAmortizada = soma(meses.map((x) => x.amortization));
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
    totalPagamentos,
    totalDistribuido,
    tetoDivida,
  };

  // ─── Indicadores ───────────────────────────────────────────────────────────
  const fluxoInvestidor = meses.map((x) => x.distribution - x.equityCall);
  // Mesmo mapa que alimenta o gatilho de custo 'por_venda': as duas leituras
  // saem daqui, então não têm como divergir.
  const unidadesVendidasPorMes = meses.map((x) => vendasPorMes.get(x.mes) ?? 0);
  const tir = tirMensal(fluxoInvestidor);
  const indicadores: Indicadores = {
    moic: razao(totalDistribuido, equityTotal),
    roi: razao(lucroInvestidores, equityTotal),
    margemVgv: razao(lucroProjeto, vgv),
    ltc: razao(dividaSacada, terrenosTotal + obraTotal),
    alavancagem: razao(dividaSacada, totalPagamentos),
    // Custo ACUMULADO da dívida sobre o principal sacado — não é taxa a.a.
    custoTotalDividaPct: razao(custoFinanceiro, dividaSacada),
    tirMensal: tir,
    tirAnual: anualizar(tir),
    xirr: xirr(fluxoInvestidor, meses.map((x) => x.data)),
  };

  // ─── Rateio por sócio — todos pro-rata ─────────────────────────────────────
  // MOIC, ROI e TIR são idênticos para todos os sócios: só a escala muda.
  const rateioSocios: RateioSocio[] = socios.map((s) => {
    const p = s.participacaoPct || 0;
    return {
      nome: s.nome,
      participacaoPct: p,
      cotaDisponivel: !!s.cotaDisponivel,
      capital: p * equityTotal,
      lucro: p * lucroInvestidores,
      total: p * equityTotal + p * lucroInvestidores,
      chamadasPorMes: meses.map((x) => p * x.equityCall),
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
    iteracoes,
    convergiu,
    overridesOrfaos: orfaos,
    celulasManuais: ativos.size,
  };
}
