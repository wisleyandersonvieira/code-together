/**
 * Modelagem financeira de incorporação — tipos do motor.
 *
 * O motor é puro: mesmos inputs, mesmo output, sem React, sem banco, sem Date.now().
 * Nenhum valor calculado é persistido — o banco guarda só inputs e overrides.
 */

/** Linhas do fluxo que aceitam override manual. Chaves estáveis: não renomear. */
export type LinhaFluxo =
  | 'land'
  | 'construction'
  | 'property_tax'
  | 'other_costs'
  | 'revenue'
  | 'draw'
  | 'amortization'
  | 'equity_call'
  | 'distribution';

export const LINHAS_FLUXO: LinhaFluxo[] = [
  'land',
  'construction',
  'property_tax',
  'other_costs',
  'revenue',
  'draw',
  'amortization',
  'equity_call',
  'distribution',
];

export const ROTULO_LINHA: Record<LinhaFluxo, string> = {
  land: 'Terrenos',
  construction: 'Obra',
  property_tax: 'Property taxes',
  other_costs: 'Custos',
  revenue: 'Receita',
  draw: 'Saque',
  amortization: 'Amortização',
  equity_call: 'Aporte de equity',
  distribution: 'Distribuição',
};

/**
 * Uma TIPOLOGIA: `quantidade` unidades iguais.
 *
 * Todo campo monetário e de área desta interface é POR UNIDADE — area, terreno,
 * obra, preço de venda e property tax. O total da tipologia é sempre
 * `valor × quantidade`, e essa multiplicação é feita no motor: nada de total é
 * gravado no banco.
 */
export interface Unidade {
  id?: number;
  nome: string;
  cidade?: string;
  /** Por unidade. */
  areaSf?: number;
  /** Por unidade. */
  custoTerreno: number;
  /** Por unidade. */
  custoObra: number;
  /** Por unidade. */
  precoVenda: number;
  /** Por unidade. */
  propertyTaxAno: number;
  /** Quantas unidades iguais a linha representa. Inteiro ≥ 1. */
  quantidade: number;
}

export type DistribuicaoCusto =
  | 'single_month'
  | 'linear_total'
  | 'linear_construction'
  | 'manual';

/**
 * Categoria do orçamento. Chaves estáveis: não renomear — são o CHECK da coluna
 * `modelagem_custos.categoria`.
 *
 * É agrupamento de SAÍDA, não regra de lançamento: a distribuição no tempo
 * continua saindo só de `distribuicao`/`mesAncora`, e trocar a categoria de uma
 * linha não muda um único mês do fluxo.
 */
export type CategoriaCusto =
  | 'terreno'
  | 'sitework'
  | 'vertical'
  | 'amenidades'
  | 'offsite'
  | 'contingencia'
  | 'soft'
  | 'financeiro'
  | 'outros';

/** Ordem de exibição do orçamento, do hard cost ao soft cost. */
export const CATEGORIAS_CUSTO: CategoriaCusto[] = [
  'terreno',
  'sitework',
  'vertical',
  'amenidades',
  'offsite',
  'contingencia',
  'soft',
  'financeiro',
  'outros',
];

export const ROTULO_CATEGORIA: Record<CategoriaCusto, string> = {
  terreno: 'Terreno',
  sitework: 'Sitework',
  vertical: 'Construção vertical',
  amenidades: 'Amenidades',
  offsite: 'Offsite',
  contingencia: 'Contingência',
  soft: 'Soft costs',
  financeiro: 'Custos financeiros',
  outros: 'Outros',
};

/**
 * Como o valor do custo é obtido.
 *
 * 'total' é o default do banco e o comportamento anterior à migration 1761300000:
 * `valor` é o total digitado. Nas demais, `valor` passa a ser DERIVADO e não deve
 * ser lido — quem manda é `valorUnitario` × o denominador das tipologias.
 *
 * Os denominadores respeitam a regra do módulo: os valores da tipologia são POR
 * UNIDADE, então área entra como `areaSf × quantidade`.
 */
export type BaseCalculoCusto = 'total' | 'por_unidade' | 'por_sf' | 'pct_de_grupo';

/** Chaves estáveis: são o CHECK de `modelagem_custos.base_calculo`. */
export const BASES_CALCULO_CUSTO: BaseCalculoCusto[] = [
  'total',
  'por_unidade',
  'por_sf',
  'pct_de_grupo',
];

export const ROTULO_BASE_CALCULO: Record<BaseCalculoCusto, string> = {
  total: 'Valor total',
  por_unidade: 'Por unidade',
  por_sf: 'Por pé quadrado',
  pct_de_grupo: '% de um grupo',
};

/** Sufixo do valor unitário, para a tela e a planilha lerem igual. */
export const SUFIXO_BASE_CALCULO: Record<BaseCalculoCusto, string> = {
  total: '',
  por_unidade: '/unidade',
  por_sf: '/sf',
  pct_de_grupo: '%',
};

/**
 * Quando o custo vence.
 *
 * 'cronograma' é o default do banco e o comportamento anterior à migration
 * 1761500000: quem manda no lançamento é `distribuicao`/`mesAncora`. Nos demais,
 * o gatilho SUBSTITUI a distribuição — o custo passa a acompanhar um evento do
 * cronograma em vez de uma curva.
 */
export type GatilhoCusto =
  | 'cronograma'
  | 'inicio_obra'
  | 'fim_obra'
  | 'por_venda'
  | 'mes_fixo';

/** Chaves estáveis: são o CHECK de `modelagem_custos.gatilho`. */
export const GATILHOS_CUSTO: GatilhoCusto[] = [
  'cronograma',
  'inicio_obra',
  'fim_obra',
  'por_venda',
  'mes_fixo',
];

export const ROTULO_GATILHO: Record<GatilhoCusto, string> = {
  cronograma: 'Pelo cronograma',
  inicio_obra: 'No início da obra',
  fim_obra: 'No fim da obra',
  por_venda: 'A cada venda',
  mes_fixo: 'Em mês fixo',
};

export const EXPLICACAO_GATILHO: Record<GatilhoCusto, string> = {
  cronograma: 'Segue a distribuição escolhida ao lado.',
  inicio_obra: 'Lançado inteiro no primeiro mês de obra.',
  fim_obra: 'Lançado inteiro no último mês de obra.',
  por_venda: 'Rateado pelas unidades vendidas em cada mês.',
  mes_fixo: 'Lançado inteiro no mês âncora, independente da distribuição.',
};

/**
 * Uma parcela de um custo com gatilho 'mes_fixo' (migration 1763000000).
 *
 * Duas parcelas no mesmo mês SOMAM em vez de uma sobrescrever a outra — é a mesma
 * leitura dos takedowns e das parcelas de aporte, e a única que não perde dinheiro
 * do usuário. Por isso a tabela não tem UNIQUE (custo_id, mes).
 */
export interface ParcelaCusto {
  id?: number;
  ordem: number;
  /** Índice do mês no cronograma, 1..prazoTotal. Igual a todo o resto do módulo. */
  mes: number;
  valor: number;
}

export interface CustoAdicional {
  id?: number;
  label: string;
  /**
   * Total do custo — INPUT apenas quando `baseCalculo` é 'total'. Nas demais
   * bases é derivado por `valorEfetivoCusto` e este campo guarda só o último
   * total digitado; não leia daqui.
   */
  valor: number;
  distribuicao: DistribuicaoCusto;
  /** Obrigatório quando distribuicao = 'single_month'; ignorado nos demais. */
  mesAncora?: number | null;
  /**
   * Agrupa a linha nos subtotais de `Agregados.custosPorCategoria`.
   * 'outros' é o default do banco e reproduz o comportamento anterior à
   * migration 1761200000.
   */
  categoria: CategoriaCusto;
  /**
   * Segundo nível: id da linha de custo que agrupa esta. Hierarquia VISUAL — o
   * motor soma cada linha uma única vez, então pai e filho nunca entram em
   * duplicidade. `null` = primeiro nível.
   */
  grupoPaiId?: number | null;
  /** 'total' (default do banco) reproduz o comportamento anterior. */
  baseCalculo: BaseCalculoCusto;
  /** Custo por unidade ou por pé quadrado. Ignorado quando a base é 'total'. */
  valorUnitario: number;
  /**
   * Categoria sobre a qual o percentual incide. Obrigatório quando `baseCalculo`
   * é 'pct_de_grupo', ignorado nas demais bases.
   *
   * A base do grupo é definida por `resolverCustos` em motor.ts: os custos
   * daquela categoria mais o custo direto das tipologias quando a categoria tem
   * contrapartida na unidade ('terreno' e 'vertical').
   */
  grupoReferencia?: CategoriaCusto | null;
  /** FRAÇÃO, não percentual: 0.05 = 5%. Ignorado fora de 'pct_de_grupo'. */
  percentual: number;
  /**
   * Quando o custo vence. 'cronograma' (default do banco) reproduz o
   * comportamento anterior; os demais SUBSTITUEM `distribuicao`.
   */
  gatilho: GatilhoCusto;
  /**
   * Parcelamento do gatilho 'mes_fixo' (migration 1763000000). Ignorado nos
   * demais gatilhos.
   *
   * Lista VAZIA é o default do banco e o comportamento anterior: 100% no
   * `mesAncora`. Com parcelas, o `mesAncora` é ignorado — o gatilho já substitui
   * a distribuição, e as parcelas substituem a âncora — e são elas que definem o
   * total lançado, não o valor efetivo da base de cálculo.
   */
  parcelas: ParcelaCusto[];
}

/**
 * Uma linha do orçamento vista MÊS A MÊS, do jeito que ela entrou no fluxo.
 *
 * É a mesma grandeza que `lancadoPorCusto` já alimentava, agora aberta no tempo:
 * o escalar continua sendo a soma da matriz, e as duas saem do MESMO `lancar` do
 * motor — não de um segundo laço, que divergiria na primeira mudança de regra.
 *
 * Sempre ANTES dos overrides: é o que o gatilho e a distribuição lançaram. O que
 * o usuário forçou à mão na linha `other_costs` não aparece aqui, e a diferença
 * é justamente a linha de "ajuste manual" que a grade mostra.
 */
export interface DetalheCusto {
  /** Índice em `input.custosAdicionais`. */
  indice: number;
  id?: number;
  label: string;
  categoria: CategoriaCusto;
  /** Lançado em cada mês, alinhado com `meses` (índice 0 = mês 1). */
  porMes: number[];
  /** Σ porMes. É o mesmo `lancadoPorCusto[indice]` que a conferência já usa. */
  total: number;
}

/**
 * Como o saque de cada mês é dimensionado.
 *
 * 'equity_first', 'cash_demand' e 'manual' são os modos de sempre.
 * 'equity_first_demanda' é o modo NOVO da migration 1763200000 — nenhuma
 * modelagem já salva o tem, então o caminho novo é inalcançável para ela.
 *
 * A diferença entre os dois modos "equity primeiro" é o TETO do saque, e é ela
 * que decide se o caixa fecha:
 *   'equity_first'         — o saque não passa da OBRA do mês. Terreno, property
 *                            tax, custos do orçamento e custo financeiro ficam
 *                            sem cobertura de dívida.
 *   'equity_first_demanda' — o saque cobre a DEMANDA do mês descontado o aporte
 *                            previsto para o mesmo mês.
 */
export type ModoSaque = 'equity_first' | 'cash_demand' | 'manual' | 'equity_first_demanda';

/** Chaves estáveis: são o CHECK de `modelagem_financiamento.modo_saque`. */
export const MODOS_SAQUE: ModoSaque[] = [
  'equity_first',
  'equity_first_demanda',
  'cash_demand',
  'manual',
];

export const ROTULO_MODO_SAQUE: Record<ModoSaque, string> = {
  // O rótulo diz o TETO de cada um: é a única diferença entre os dois modos
  // "equity primeiro", e sem ela na tela a escolha vira adivinhação.
  equity_first: 'Equity primeiro, saque limitado à obra',
  equity_first_demanda: 'Equity primeiro, saque pela demanda de caixa',
  cash_demand: 'Demanda de caixa',
  manual: 'Manual',
};

export const EXPLICACAO_MODO_SAQUE: Record<ModoSaque, string> = {
  equity_first:
    'O capital próprio entra primeiro na obra; a dívida só começa quando a obra acumulada passa do aporte base disponível, e o saque do mês não passa da obra do mês.',
  equity_first_demanda:
    'O capital próprio entra primeiro; o saque cobre exatamente o que falta para pagar o mês e manter o colchão. O caixa fecha no colchão em vez de ficar negativo.',
  cash_demand:
    'A dívida é dimensionada pela necessidade real de caixa de cada mês, respeitando o teto.',
  manual: 'Nenhum saque automático — só o que for lançado à mão no fluxo.',
};

/**
 * Como a dívida é quitada.
 *
 * 'at_exit' — todo o saldo remanescente sai no mês da saída.
 * 'manual'  — nenhuma amortização automática, só overrides.
 *
 * Em QUALQUER um dos dois, o release por unidade vendida amortiza no mês da
 * venda: release não é modo de amortização, é cláusula do contrato, e vale
 * junto com o modo escolhido.
 *
 * 'price' (prestação constante) e 'sac' (principal constante) existiram entre as
 * migrations 1762200000 e 1763400000 e foram REMOVIDOS. A 1763400000 converteu
 * as linhas que os tinham em 'manual' — que é exatamente o resultado que elas já
 * produziam desde que o passo 3 do motor passou a ser release + quitação na
 * saída. `prazoMeses`, `carenciaMeses`, `amortizacaoMeses` e
 * `balloonNoVencimento` continuam no input e no banco por compatibilidade, mas
 * não têm efeito em lugar nenhum.
 */
export type ModoAmortizacao = 'at_exit' | 'manual';

export const MODOS_AMORTIZACAO: ModoAmortizacao[] = ['at_exit', 'manual'];

export const ROTULO_MODO_AMORTIZACAO: Record<ModoAmortizacao, string> = {
  at_exit: 'Quitação na saída',
  manual: 'Manual',
};

export type MomentoFee = 'first_draw' | 'contract_month';

/**
 * Como o juro do mês é contado.
 *
 * 'mensal_12' é o default do banco e a conta anterior à migration 1762400000.
 * '30_360' dá aritmeticamente o MESMO número — existe para o usuário declarar a
 * convenção do contrato, não para mudar o resultado.
 */
export type ConvencaoJuros = 'mensal_12' | '30_360' | 'actual_360' | 'actual_365';

export const CONVENCOES_JUROS: ConvencaoJuros[] = [
  'mensal_12',
  '30_360',
  'actual_360',
  'actual_365',
];

export const ROTULO_CONVENCAO_JUROS: Record<ConvencaoJuros, string> = {
  mensal_12: 'Mensal (taxa ÷ 12)',
  '30_360': '30/360',
  actual_360: 'Dias corridos / 360',
  actual_365: 'Dias corridos / 365',
};

export type TipoTaxa = 'fixa' | 'variavel';

/** Um ponto da curva projetada do benchmark. `mes` é índice, não data. */
export interface PontoBenchmark {
  id?: number;
  mes: number;
  /** Fração ao ano: 0.045 = 4,5%. */
  valor: number;
}

export interface Financiamento {
  /** Taxa nominal ao ano. 0.095 = 9,5% a.a. */
  taxaAnual: number;
  feeEstruturacaoPct: number;
  feeTiming: MomentoFee;
  /** Obrigatório quando feeTiming = 'contract_month'. */
  feeMes?: number | null;
  mesInicioSaque: number;
  mesFimSaque: number;
  modoSaque: ModoSaque;
  /** Teto por LTC. Nulo = sem teto por LTC. */
  maxLtcPct?: number | null;
  /** Valor contratado. Tem precedência sobre maxLtcPct. Nulo = usa o LTC. */
  valorContratado?: number | null;
  /**
   * false (default): a dívida é dimensionada só pelos custos operacionais e
   * juros/fee ficam por conta do equity.
   * true: a dívida financia também o próprio custo financeiro — exige iteração.
   */
  custoFinanceiroNaDemanda: boolean;
  modoAmortizacao: ModoAmortizacao;
  capitalizarJuros: boolean;
  colchaoMinimoCaixa: number;
  /**
   * Linha de crédito ROTATIVA (migration 1763300000).
   *
   * TRUE: amortizar devolve limite, e a capacidade de saque do mês é
   * `teto − saldo devedor de abertura`.
   * FALSE (default, e toda modelagem já gravada): facilidade não rotativa — o
   * teto vale para o TOTAL desembolsado ao longo da vida do empréstimo, e
   * capacidade consumida não volta.
   *
   * Muda também o que `teto_divida` cobra: pico do saldo devedor na rotativa,
   * total sacado na não rotativa.
   */
  linhaRotativa: boolean;

  // ─── Reserva de juros (migration 1762100000) ───────────────────────────────
  /**
   * Saldo que paga os juros até acabar. 0 (default) = sem reserva, e cada mês cai
   * exatamente no caminho anterior à migration.
   *
   * NÃO substitui `capitalizarJuros`: os dois coexistem, e a ordem é reserva
   * primeiro, capitalização depois.
   */
  reservaJuros: number;
  /**
   * true (default): constituída no primeiro saque e sacada do próprio empréstimo
   * — soma ao principal e rende juros, sem passar pelo caixa do projeto.
   * false: bancada pelo equity e apenas ORÇAMENTÁRIA — não aumenta a dívida nem
   * gera chamada de capital própria; os juros só deixam de sair do caixa.
   */
  reservaJurosSacada: boolean;

  // ─── Carência, prestação e balloon (1762200000, INERTES desde a 1763400000) ─
  // Os quatro campos existiam para os modos 'price' e 'sac'. Com os dois modos
  // removidos, NENHUM deles tem efeito: não entram no fluxo, não alimentam
  // conferência e não aparecem na interface. Continuam no tipo e no banco para
  // não apagar o que o usuário declarou — e para quem for reintroduzir
  // amortização por prestação encontrar os dados no lugar.
  /** INERTE. Prazo da dívida a partir de `mesInicioSaque`. Nulo = sem vencimento. */
  prazoMeses?: number | null;
  /** INERTE. Meses de interest-only contados de `mesInicioSaque`. */
  carenciaMeses: number;
  /** INERTE. Prazo de amortização. Maior que `prazoMeses` é o que gerava o balloon. */
  amortizacaoMeses?: number | null;
  /** INERTE. No vencimento, amortizava todo o saldo remanescente de uma vez. */
  balloonNoVencimento: boolean;

  // ─── Release price (migration 1762300000) ──────────────────────────────────
  /** Valor fixo liberado ao banco por unidade vendida. Vence `releasePricePct`. */
  releasePrice: number;
  /** Fração do preço de venda das unidades do mês. Só lido com `releasePrice` = 0. */
  releasePricePct?: number | null;

  // ─── Convenção e indexação (migrations 1762400000 e 1762500000) ────────────
  convencaoJuros: ConvencaoJuros;
  tipoTaxa: TipoTaxa;
  /** Fração ao ano somada ao benchmark. Só lido com `tipoTaxa = 'variavel'`. */
  spread: number;
  benchmarkNome?: string | null;
  /** Usado nos meses sem ponto na curva — mês ausente não é benchmark zero. */
  benchmarkPadrao: number;
  /** Curva projetada do benchmark, mês a mês. */
  benchmarkCurva?: PontoBenchmark[];
}

/**
 * Um aporte de capital de UM sócio (migration 1763100000).
 *
 * Dois aportes do mesmo sócio no mesmo mês SOMAM em vez de um sobrescrever o
 * outro — mesma leitura dos takedowns e das parcelas de custo. Por isso a tabela
 * não tem UNIQUE (socio_id, mes).
 */
export interface SocioAporte {
  id?: number;
  ordem: number;
  /** Índice do mês no cronograma, 1..prazoTotal. Igual ao resto do módulo. */
  mes: number;
  valor: number;
  observacao?: string | null;
}

export interface Socio {
  id?: number;
  nome: string;
  /**
   * Fração, não percentual: 0.5 = 50%. Governa o LUCRO — e, só na regra
   * 'participacao', também o capital.
   */
  participacaoPct: number;
  /** Cota ainda não colocada. Continua no rateio pro-rata; a flag é só sinalização. */
  cotaDisponivel: boolean;
  /**
   * Fração do CAPITAL chamado. Só vale com `regraRateioCapital = 'pct_capital'`.
   *
   * `null` é diferente de zero e a distinção importa: `null` = "usa
   * `participacaoPct`", que é o comportamento anterior à migration 1763100000;
   * `0` = "este sócio não põe capital nenhum".
   */
  pctCapital?: number | null;
  /**
   * Cronograma próprio de capital. Só tem efeito com
   * `regraRateioCapital = 'cronograma_socio'`; nas demais regras fica guardado e
   * inativo — nunca apagado. Lista vazia é o estado de toda linha já gravada.
   */
  aportes: SocioAporte[];
}

/**
 * Como o capital chamado se reparte entre os sócios.
 *
 * NÃO confundir com `participacaoPct`, que governa o LUCRO. Um sócio pode ter 30%
 * da sociedade e ter posto 40% do dinheiro — é o caso das negociações individuais,
 * e é a razão de existir desta regra.
 *
 * 'participacao' é o default do banco e o comportamento anterior à migration
 * 1763100000: a fração de capital É a participação, e por isso MOIC, ROI e TIR
 * saíam idênticos para todos os sócios.
 */
export type RegraRateioCapital = 'participacao' | 'pct_capital' | 'cronograma_socio';

/** Chaves estáveis: são o CHECK de `modelagem_aportes.regra_rateio_capital`. */
export const REGRAS_RATEIO_CAPITAL: RegraRateioCapital[] = [
  'participacao',
  'pct_capital',
  'cronograma_socio',
];

export const ROTULO_REGRA_CAPITAL: Record<RegraRateioCapital, string> = {
  participacao: 'Pela participação',
  pct_capital: 'Por percentual de capital',
  cronograma_socio: 'Cronograma por sócio',
};

export const EXPLICACAO_REGRA_CAPITAL: Record<RegraRateioCapital, string> = {
  participacao:
    'Cada sócio entra com a fatia igual à sua participação na sociedade.',
  pct_capital:
    'Cada sócio entra com uma fatia própria, que pode diferir da participação.',
  cronograma_socio:
    'Cada sócio tem seus próprios valores e meses de aporte.',
};

export type ModoAporte = 'demanda' | 'plano';

/** Uma parcela do plano de aportes. `mes` é índice do cronograma, não data. */
export interface AporteParcela {
  id?: number;
  mes: number;
  valor: number;
  observacao?: string | null;
}

/**
 * Plano de aportes do projeto — uma premissa da modelagem, não da unidade.
 *
 * Substitui o antigo `Unidade.aporteBase`, que era um atributo por unidade
 * somado pelo motor.
 *
 * Os dois modos, no espírito de `ModoSaque` e `ModoVenda`:
 *
 *   'demanda' — o motor calcula o aporte de cada mês como resíduo do caixa, e
 *     `aporteBaseTotal` é a premissa que dimensiona a curva do modo equity_first.
 *     É o comportamento anterior a esta versão, e o default.
 *   'plano' — as `parcelas` mandam: o aporte do mês é o valor da parcela daquele
 *     mês e ZERO nos meses sem parcela. O caixa fica negativo quando o plano não
 *     cobre a demanda, e é justamente isso que o usuário quer enxergar; a
 *     conferência de caixa mínimo acusa.
 *
 * Em nenhum dos dois o plano vence um override em `equity_call`: override é a
 * invariante do módulo e continua ganhando de tudo.
 */
export interface PlanoAportes {
  modoAporte: ModoAporte;
  /**
   * Premissa que dimensiona a curva do modo equity_first. NÃO é o aporte real:
   * o capital efetivamente chamado sai do fluxo (equity_call).
   */
  aporteBaseTotal: number;
  /** Alvo declarado. Não é imposto — se as parcelas não somarem, acende âmbar. */
  valorTotalAlvo: number;
  parcelas?: AporteParcela[];
  /**
   * Como o capital se reparte entre os sócios (migration 1763100000).
   *
   * Ortogonal a `modoAporte`, que decide de ONDE vem o total do mês. Esta decide
   * PARA QUEM ele vai — com uma exceção: em 'cronograma_socio' a soma dos aportes
   * dos sócios passa a ser também a origem do total, e vence `modoAporte`.
   *
   * 'participacao' é o default e reproduz exatamente o rateio anterior.
   */
  regraRateioCapital: RegraRateioCapital;
}

/**
 * Uma fase do empreendimento. Só tem efeito com `ModelInput.usaFases = true`.
 *
 * As datas são o input do usuário; o motor deriva o índice do mês a partir de
 * `ModelInput.dataInicio` (ver `indiceMes`). Guardar índice aqui faria a fase se
 * deslocar sozinha toda vez que o início do projeto mudasse.
 */
export interface Fase {
  id?: number;
  ordem: number;
  nome: string;
  /** ISO 'YYYY-MM-DD'. */
  dataInicio: string;
  /** ISO 'YYYY-MM-DD'. */
  dataFim: string;
}

/**
 * Quantas unidades de uma tipologia caem numa fase.
 *
 * Índices, não ids — mesma convenção de `VendaUnidade`. O banco guarda por id
 * (`modelagem_unidade_fases`) e a conversão acontece em `mapearModelInput`, com o
 * mesmo Map<id, índice> que a venda por unidade já usa.
 */
export interface AlocacaoFase {
  id?: number;
  /** Índice da tipologia no array `unidades`. */
  unidadeIndex: number;
  /** Índice da fase no array `fases`. */
  faseIndex: number;
  quantidade: number;
}

export type ModoVenda = 'single_exit' | 'per_unit' | 'manual' | 'takedown';

/**
 * Um lote de venda: N unidades de uma tipologia fechando num mês.
 *
 * É o que uma pro forma real chama de takedown — 3 ou 4 casas por mês, cada leva
 * com seu preço. Substitui, para quem precisa escalonar, o `per_unit`, em que a
 * tipologia inteira vende de uma vez.
 *
 * Índices, não ids — mesma convenção de `VendaUnidade` e `AlocacaoFase`. O banco
 * guarda por id (`modelagem_takedowns`) e a conversão acontece em
 * `mapearModelInput`, com o mesmo Map<id, índice> que a venda por unidade usa.
 */
export interface Takedown {
  id?: number;
  /** Índice da tipologia no array `unidades`. */
  unidadeIndex: number;
  /** Índice da fase no array `fases`. `null` = lote sem fase declarada. */
  faseIndex?: number | null;
  ordem: number;
  /** Índice do cronograma, não data. */
  mes: number;
  /** Quantas unidades da tipologia fecham neste lote. Inteiro ≥ 1. */
  quantidade: number;
  /**
   * Preço POR UNIDADE deste lote. ZERO significa "usar o preço da tipologia" —
   * é o caso comum e o default do banco. Semântica declarada, não ausência de
   * valor: um lote vendido a zero de verdade não existe.
   */
  precoUnitario: number;
  observacao?: string | null;
}

export interface VendaUnidade {
  /** Índice da unidade no array `unidades` do input. */
  unidadeIndex: number;
  mesVenda: number;
}

export interface Receita {
  comissaoPct: number;
  custoCartorioPct: number;
  modoVenda: ModoVenda;
  /** Nulo = usa prazoTotal. */
  mesSaida?: number | null;
  lucroInvestidoresPct: number;
  lucroSponsorPct: number;
  vendasPorUnidade?: VendaUnidade[];
  /** Só tem efeito com `modoVenda = 'takedown'`. */
  takedowns?: Takedown[];
}

/**
 * Override de uma célula do fluxo.
 *
 * `valor = 0` significa "forcei este mês a zero"; `limpar = true` força a célula
 * a VAZIO. São coisas diferentes — sem essa distinção o princípio "vazio ≠ zero"
 * não é representável.
 */
export interface Override {
  mes: number;
  linha: LinhaFluxo;
  valor?: number | null;
  limpar?: boolean;
}

export interface ModelInput {
  nome?: string;
  localizacao?: string;
  tipoUso?: string;
  moeda?: string;
  /** Data do mês 1, ISO 'YYYY-MM-DD'. */
  dataInicio: string;
  mesesAprovacao: number;
  mesesConstrucao: number;
  mesesPosObra: number;
  horizonteMaximo?: number;
  unidades: Unidade[];
  custosAdicionais?: CustoAdicional[];
  aportes?: PlanoAportes;
  /** false (default) = frente única: o cronograma de obra é um só. */
  usaFases?: boolean;
  /** Só tem efeito com `usaFases`. false = terreno inteiro no mês 1. */
  terrenoPorFase?: boolean;
  fases?: Fase[];
  /**
   * Distribuição das unidades entre as fases. Só tem efeito com `usaFases`.
   * O que não estiver alocado não entra no fluxo — e a conferência
   * `alocacao_fases` acende vermelho e bloqueia o salvamento.
   */
  alocacoes?: AlocacaoFase[];
  financiamento: Financiamento;
  socios?: Socio[];
  receita: Receita;
  overrides?: Override[];
}

/** Uma coluna do quadro mensal. Só existem meses 1..prazoTotal — o resto é vazio, não zero. */
export interface MesFluxo {
  mes: number;
  data: string;
  land: number;
  construction: number;
  propertyTax: number;
  otherCosts: number;
  pagamentosOperacionais: number;
  /** Juros incorridos no mês (entram na apuração mesmo quando capitalizados). */
  juros: number;
  fee: number;
  /** Parte dos `juros` do mês absorvida pela reserva. Não toca o caixa. */
  jurosPagosPelaReserva: number;
  /** Saldo da reserva de juros no FIM do mês. */
  saldoReservaJuros: number;
  /** Saída de caixa por conta do financiamento: juros pagos (0 se capitalizados) + fee. */
  custoFinanceiroCaixa: number;
  pagamentos: number;
  revenue: number;
  draw: number;
  /**
   * Saque destinado à reserva de juros. Soma ao principal e à `dividaSacada`, mas
   * NÃO entra no caixa: o dinheiro vai direto para a conta da reserva. Zero fora
   * do mês em que a reserva é constituída, e sempre zero quando a reserva é
   * apenas orçamentária (`reservaJurosSacada = false`).
   */
  saqueReservaJuros: number;
  amortization: number;
  equityCall: number;
  distribution: number;
  saldoDevedor: number;
  equityAcumulado: number;
  caixaAbertura: number;
  caixaMes: number;
  caixaAcumulado: number;
  /** pagamentos + amortização − receita. Alimenta a tela de Demanda de Caixa. */
  demandaBruta: number;
  /**
   * Demanda do mês DIMENSIONADA pelo modo de saque — o número que o motor de
   * fato usou para calcular o saque: pagamentos + amortização + colchão −
   * receita − caixa de abertura, e no modo 'equity_first_demanda' também menos o
   * aporte previsto do mês. Zero quando o mês é superavitário.
   *
   * NÃO é `demandaBruta`: aquela ignora colchão, caixa de abertura e aporte, e
   * existe só como leitura comparável entre meses.
   */
  demandaDimensionada: number;
  /**
   * Parte de `demandaDimensionada` coberta pelo saque do mês. Nunca maior que a
   * demanda: um saque acima dela (override, ou saque do modo equity_first que
   * passa da necessidade) sobra em caixa e não é "cobertura".
   */
  demandaCoberta: number;
  /**
   * O que sobrou sem cobertura: demanda − saque, quando positivo. É o buraco que
   * o caixa do mês vai mostrar — por teto de dívida, por janela de saque fechada
   * ou por aporte insuficiente. Zero quando o mês fecha.
   */
  demandaDescoberta: number;
  /**
   * Amortização PREVISTA que dimensionou o saque do mês: o release do mês mais,
   * no mês da saída, o remanescente do saldo de abertura. Não é a amortização
   * realizada (`amortization`), que pode ser maior no mês de saída porque o
   * saque do próprio mês entra na base.
   */
  amortizacaoPrevista: number;
  /** Quanto da `amortization` do mês foi release por unidade vendida. */
  amortizacaoRelease: number;
  /**
   * Capacidade de saque restante no início do mês. Numa linha rotativa é
   * `teto − saldo devedor de abertura`; numa não rotativa, `teto − total já
   * desembolsado`.
   */
  capacidadeSaque: number;
  /** Taxa ao ano efetivamente aplicada no mês. Com `tipoTaxa = 'fixa'` é constante. */
  taxaEfetivaAno: number;
  /** Unidades que fecham no mês. Explica o degrau da amortização por release. */
  unidadesVendidas: number;
  /**
   * Equity que o plano de aportes já colocou no projeto até este mês, descontado
   * o terreno — é o que o modo equity_first compara com a obra acumulada. No modo
   * 'demanda' é constante em todos os meses (o valor único do aporte base).
   */
  equityDisponivelAcumulado: number;
}

export interface Apuracao {
  receitaBruta: number;
  comissoes: number;
  cartorio: number;
  receitaLiquida: number;
  custoTerrenos: number;
  custoObra: number;
  custoPropertyTax: number;
  custoOutros: number;
  custoEmpreendimento: number;
  jurosTotais: number;
  feeTotal: number;
  custoFinanceiro: number;
  lucroProjeto: number;
  lucroInvestidores: number;
  lucroSponsor: number;
  equityTotal: number;
  dividaSacada: number;
  dividaAmortizada: number;
  /**
   * Pico do saldo devedor ao longo dos meses — a grandeza que um contrato
   * ROTATIVO limita. Numa linha não rotativa o que o teto limita é
   * `dividaSacada`, o total desembolsado.
   */
  saldoDevedorMaximo: number;
  totalPagamentos: number;
  totalDistribuido: number;
  tetoDivida: number;
}

export interface Indicadores {
  moic: number | null;
  roi: number | null;
  margemVgv: number | null;
  /** Total DESEMBOLSADO sobre o custo direto. Fórmula inalterada desde sempre. */
  ltc: number | null;
  /**
   * PICO do saldo devedor sobre o custo direto — o LTC que um covenant de linha
   * rotativa cobra. Sem amortização antes do fim, coincide com `ltc`.
   */
  ltcPico: number | null;
  alavancagem: number | null;
  /** Custo acumulado da dívida sobre o principal sacado. NÃO é taxa a.a. */
  custoTotalDividaPct: number | null;
  tirMensal: number | null;
  tirAnual: number | null;
  xirr: number | null;

  // ─── Por unidade e por pé quadrado ─────────────────────────────────────────
  // Derivação PURA de `apuracao` e `agregados`: não há input novo nem migration.
  // Denominador zero devolve `null`, nunca NaN nem Infinity — é a mesma regra dos
  // demais indicadores, e `razao` em indicadores.ts é quem a aplica.
  /**
   * Custo TOTAL do projeto por unidade: (custoEmpreendimento + custoFinanceiro)
   * ÷ unidadesTotal. Multiplicado de volta por `unidadesTotal`, reconstitui a
   * apuração — há teste cobrando isso.
   */
  custoPorUnidade: number | null;
  /** Mesmo numerador de `custoPorUnidade`, dividido pela área total. */
  custoPorSf: number | null;
  /** VGV ÷ unidadesTotal. É preço BRUTO, antes de comissão e cartório. */
  precoMedioPorUnidade: number | null;
  /** VGV ÷ área total. Bruto, para casar com `precoMedioPorUnidade`. */
  receitaPorSf: number | null;
  /** Lucro do projeto ÷ unidadesTotal. */
  margemPorUnidade: number | null;
}

/**
 * O que cada sócio pôs, o que recebeu e a que taxa — apurado a partir do FLUXO,
 * não de uma fração aplicada sobre a apuração.
 *
 * A diferença importa: com datas de aporte próprias, dois sócios com a mesma
 * fração de capital têm TIRs diferentes, e nenhum número derivado de percentual
 * sobre o total conseguiria mostrar isso.
 */
export interface RateioSocio {
  nome: string;
  /** Governa o LUCRO. Continua sendo a participação na sociedade. */
  participacaoPct: number;
  cotaDisponivel: boolean;
  /**
   * Fração EFETIVA do capital do projeto, qualquer que seja a regra. Em
   * 'participacao' é a própria `participacaoPct` — daí a não-regressão.
   */
  pctCapital: number;
  /** Capital efetivamente aportado por ele: Σ `chamadasPorMes`. */
  capital: number;
  /** Camada de lucro que ele recebeu. Com tudo automático, é p × lucroInvestidores. */
  lucro: number;
  /** Capital devolvido + lucro. É Σ `devolucoesPorMes`. */
  total: number;
  /** Aporte REAL do sócio mês a mês, alinhado com `meses`. */
  chamadasPorMes: number[];
  /** Quanto ele recebe em cada mês: devolução de capital + lucro. */
  devolucoesPorMes: number[];
  /** devoluções − chamadas. É a base da TIR DELE. */
  fluxoPorMes: number[];
  /** `null` — nunca Infinity, nunca NaN — quando o capital dele é zero. */
  moic: number | null;
  roi: number | null;
  tirMensal: number | null;
  tirAnual: number | null;
  xirr: number | null;
}

export type RegraRateioUnidade = 'custo_direto' | 'preco_venda' | 'area';

/** Resultado de uma tipologia. Salvo onde dito o contrário, tudo é TOTAL das N unidades. */
export interface ResultadoUnidade {
  nome: string;
  quantidade: number;
  custoTerreno: number;
  custoObra: number;
  custoDireto: number;
  /** Fração usada para ratear custos que não pertencem a nenhuma unidade. */
  fatorRateio: number;
  custosCompartilhados: number;
  custoFinanceiro: number;
  custoTotal: number;
  /** custoTotal ÷ quantidade. */
  custoTotalUnitario: number;
  receitaLiquida: number;
  /** receitaLiquida ÷ quantidade. */
  receitaLiquidaUnitaria: number;
  lucro: number;
  margem: number | null;
}

export type Semaforo = 'verde' | 'ambar' | 'vermelho';

export interface Conferencia {
  chave: string;
  titulo: string;
  semaforo: Semaforo;
  valor: string;
  detalhe: string;
  /** O que fazer quando falha. Nunca bloqueia o cálculo. */
  comoResolver: string;
}

/** Fase com os índices de mês já derivados. A interface não recalcula nada. */
export interface FaseCronograma {
  nome: string;
  /** Índice 1-based, já limitado a 1..prazoTotal. */
  mesInicio: number;
  mesFim: number;
  dataInicio: string;
  dataFim: string;
}

export interface Cronograma {
  prazoTotal: number;
  mesInicioObra: number;
  mesFimObra: number;
  mesSaida: number;
  horizonteMaximo: number;
  dataInicio: string;
  dataInicioObra: string;
  dataFimObra: string;
  dataSaida: string;
  /** Vazio quando `usaFases` é false. */
  fases: FaseCronograma[];
}

export interface Agregados {
  terrenosTotal: number;
  obraTotal: number;
  /** Σ quantidade das tipologias: quantas unidades o projeto tem de fato. */
  unidadesTotal: number;
  vgv: number;
  taxAnoTotal: number;
  propertyTaxTotal: number;
  equityDisponivelObra: number;
  /** Σ das parcelas do plano de aportes. Comparar com `Apuracao.equityTotal`. */
  aportePlanejadoTotal: number;
  /**
   * Subtotal dos custos adicionais por categoria do orçamento.
   *
   * Sempre com TODAS as categorias presentes, inclusive as zeradas: quem lê não
   * precisa distinguir "categoria sem lançamento" de "chave ausente".
   *
   * Σ das categorias = Σ dos custos adicionais lançados. NÃO é `Apuracao.custoOutros`:
   * aquele é o que caiu dentro do prazo do cronograma, este é o orçamento inteiro
   * como o usuário o declarou — um custo em mês fora do prazo aparece aqui e não lá.
   */
  custosPorCategoria: Record<CategoriaCusto, number>;
  /**
   * Σ (areaSf × quantidade). A área é POR UNIDADE na tipologia, então o total
   * multiplica pela quantidade — mesma regra de `terrenosTotal` e `vgv`.
   *
   * É o denominador de `custoPorSf` e `receitaPorSf`, e por isso precisa estar no
   * output: sem ele, quem lê um $/sf não tem como auditar de onde veio.
   */
  areaTotalSf: number;
}

export interface ModelOutput {
  cronograma: Cronograma;
  agregados: Agregados;
  meses: MesFluxo[];
  apuracao: Apuracao;
  indicadores: Indicadores;
  rateioSocios: RateioSocio[];
  resultadoUnidades: ResultadoUnidade[];
  conferencias: Conferencia[];
  /** Fluxo do investidor por mês: distribution − equity_call. Base da TIR. */
  fluxoInvestidor: number[];
  /**
   * Quantas unidades fecham em cada mês, alinhado com `meses` (índice 0 = mês 1).
   *
   * Derivado do modo de venda: no takedown é Σ quantidade dos lotes daquele mês;
   * no per_unit é a quantidade das tipologias que vendem ali; no single_exit é
   * tudo no mês de saída; no manual é zero em toda parte, porque o usuário não
   * declarou cronograma de venda nenhum.
   *
   * É a mesma grandeza que o gatilho de custo 'por_venda' usa para ratear impact
   * fees — as duas leituras saem daqui, e por isso não podem divergir.
   *
   * É exatamente `meses.map((m) => m.unidadesVendidas)`: existe como array solto
   * porque quem consome a série inteira (gráficos, release price) não quer varrer
   * `MesFluxo`. Uma fonte só, duas formas.
   */
  unidadesVendidasPorMes: number[];
  /**
   * Cada custo adicional aberto mês a mês, na ordem de `input.custosAdicionais`.
   *
   * Para todo mês m, Σ detalhamentoCustos[i].porMes[m] é exatamente o
   * `otherCosts` daquele mês ANTES dos overrides — é o que torna o detalhamento
   * auditável em vez de decorativo.
   *
   * NÃO existe um agregado por categoria aqui de propósito: agrupar é leitura, e
   * `agruparCustosPorCategoria` faz isso a partir desta lista. Uma fonte só.
   */
  detalhamentoCustos: DetalheCusto[];
  /** Quantas passadas o ponto fixo consumiu e se convergiu. */
  iteracoes: number;
  convergiu: boolean;
  /** Overrides que caíram fora do prazo — guardados, inativos, nunca apagados. */
  overridesOrfaos: Override[];
  /** Quantas células estão em modo manual e ativas. */
  celulasManuais: number;
}
