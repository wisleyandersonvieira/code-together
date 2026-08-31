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
  other_costs: 'Outros custos',
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
export type BaseCalculoCusto = 'total' | 'por_unidade' | 'por_sf';

/** Chaves estáveis: são o CHECK de `modelagem_custos.base_calculo`. */
export const BASES_CALCULO_CUSTO: BaseCalculoCusto[] = ['total', 'por_unidade', 'por_sf'];

export const ROTULO_BASE_CALCULO: Record<BaseCalculoCusto, string> = {
  total: 'Valor total',
  por_unidade: 'Por unidade',
  por_sf: 'Por pé quadrado',
};

/** Sufixo do valor unitário, para a tela e a planilha lerem igual. */
export const SUFIXO_BASE_CALCULO: Record<BaseCalculoCusto, string> = {
  total: '',
  por_unidade: '/unidade',
  por_sf: '/sf',
};

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
}

export type ModoSaque = 'equity_first' | 'cash_demand' | 'manual';
export type ModoAmortizacao = 'at_exit' | 'manual';
export type MomentoFee = 'first_draw' | 'contract_month';

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
}

export interface Socio {
  id?: number;
  nome: string;
  /** Fração, não percentual: 0.5 = 50%. */
  participacaoPct: number;
  /** Cota ainda não colocada. Continua no rateio pro-rata; a flag é só sinalização. */
  cotaDisponivel: boolean;
}

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

export type ModoVenda = 'single_exit' | 'per_unit' | 'manual';

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
  /** Saída de caixa por conta do financiamento: juros pagos (0 se capitalizados) + fee. */
  custoFinanceiroCaixa: number;
  pagamentos: number;
  revenue: number;
  draw: number;
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
  /** Capacidade de saque restante no início do mês. */
  capacidadeSaque: number;
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
  totalPagamentos: number;
  totalDistribuido: number;
  tetoDivida: number;
}

export interface Indicadores {
  moic: number | null;
  roi: number | null;
  margemVgv: number | null;
  ltc: number | null;
  alavancagem: number | null;
  /** Custo acumulado da dívida sobre o principal sacado. NÃO é taxa a.a. */
  custoTotalDividaPct: number | null;
  tirMensal: number | null;
  tirAnual: number | null;
  xirr: number | null;
}

export interface RateioSocio {
  nome: string;
  participacaoPct: number;
  cotaDisponivel: boolean;
  capital: number;
  lucro: number;
  total: number;
  /** Chamada de capital do sócio mês a mês, alinhada com `meses`. */
  chamadasPorMes: number[];
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
  /** Quantas passadas o ponto fixo consumiu e se convergiu. */
  iteracoes: number;
  convergiu: boolean;
  /** Overrides que caíram fora do prazo — guardados, inativos, nunca apagados. */
  overridesOrfaos: Override[];
  /** Quantas células estão em modo manual e ativas. */
  celulasManuais: number;
}
