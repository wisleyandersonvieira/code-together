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

export interface Unidade {
  id?: number;
  nome: string;
  cidade?: string;
  areaSf?: number;
  custoTerreno: number;
  custoObra: number;
  /** Premissa que dimensiona a curva do modo equity_first. NÃO é o aporte real. */
  aporteBase: number;
  precoVenda: number;
  propertyTaxAno: number;
}

export type DistribuicaoCusto =
  | 'single_month'
  | 'linear_total'
  | 'linear_construction'
  | 'manual';

export interface CustoAdicional {
  id?: number;
  label: string;
  valor: number;
  distribuicao: DistribuicaoCusto;
  /** Obrigatório quando distribuicao = 'single_month'; ignorado nos demais. */
  mesAncora?: number | null;
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

export interface ResultadoUnidade {
  nome: string;
  custoTerreno: number;
  custoObra: number;
  custoDireto: number;
  /** Fração usada para ratear custos que não pertencem a nenhuma unidade. */
  fatorRateio: number;
  custosCompartilhados: number;
  custoFinanceiro: number;
  custoTotal: number;
  receitaLiquida: number;
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
}

export interface Agregados {
  terrenosTotal: number;
  obraTotal: number;
  aporteBase: number;
  vgv: number;
  taxAnoTotal: number;
  propertyTaxTotal: number;
  equityDisponivelObra: number;
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
