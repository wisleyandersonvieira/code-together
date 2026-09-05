/**
 * Modelagens de referência dos testes de relatório.
 *
 * Moram fora do arquivo de teste porque quatro suítes diferentes precisam das
 * MESMAS duas modelagens — a de venda e a de locação — e uma cópia por suíte
 * seria quatro verdades sobre o que é "um projeto de locação típico".
 *
 * As duas montam o input COMO ELE VEM DO BANCO: lista de `financiamentos` e
 * campo único `financiamento` AUSENTE. É o formato que `mapearModelInput`
 * devolve desde a migration 1764200000, e é justamente o que um input escrito à
 * mão não exercita — foi assim que um `TypeError` derrubou os dois relatórios em
 * PDF inteiros sem nenhum teste acusar.
 */
import type { ModelInput } from '@/lib/modelagem';

/** Uma facilidade completa, no formato que o mapeador produz. */
export const facilidade = (): NonNullable<ModelInput['financiamentos']>[number] => ({
  ordem: 0,
  nome: 'Financiamento',
  ativo: true,
  refinanciaIndex: null,
  taxaAnual: 0.095,
  feeEstruturacaoPct: 0.015,
  feeTiming: 'first_draw',
  feeMes: null,
  mesInicioSaque: 13,
  mesFimSaque: 23,
  modoSaque: 'equity_first',
  maxLtcPct: null,
  valorContratado: null,
  custoFinanceiroNaDemanda: false,
  modoAmortizacao: 'at_exit',
  capitalizarJuros: false,
  linhaRotativa: false,
  colchaoMinimoCaixa: 0,
  reservaJuros: 0,
  reservaJurosSacada: true,
  prazoMeses: null,
  carenciaMeses: 0,
  amortizacaoMeses: null,
  balloonNoVencimento: true,
  releasePrice: 0,
  releasePricePct: null,
  convencaoJuros: 'mensal_12',
  tipoTaxa: 'fixa',
  spread: 0,
  benchmarkNome: null,
  benchmarkPadrao: 0,
  benchmarkCurva: [],
});

/**
 * Modelagem de VENDA como vem do banco.
 *
 * `financiamento` fica AUSENTE de propósito — é o estado real de todo input que
 * passa por `mapearModelInput`, e é o que o bug original explorava.
 */
export const vendaDoBanco = (): ModelInput => ({
  nome: 'Venda',
  tipoModelagem: 'venda',
  dataInicio: '2025-12-01',
  mesesAprovacao: 10,
  mesesConstrucao: 8,
  mesesPosObra: 5,
  horizonteMaximo: 60,
  unidades: [
    { nome: 'A1', quantidade: 2, areaSf: 1_800, custoTerreno: 25_000, custoObra: 210_000, precoVenda: 320_000, propertyTaxAno: 850 },
    { nome: 'B1', quantidade: 2, areaSf: 2_600, custoTerreno: 95_000, custoObra: 460_000, precoVenda: 825_000, propertyTaxAno: 1_800 },
  ],
  custosAdicionais: [
    { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'contingencia', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma', parcelas: [] },
  ],
  aportes: { modoAporte: 'demanda', aporteBaseTotal: 732_778, valorTotalAlvo: 0, regraRateioCapital: 'participacao' },
  financiamentos: [facilidade()],
  socios: [
    { nome: 'Sócio 1', participacaoPct: 0.6, cotaDisponivel: false, aportes: [] },
    { nome: 'Sócio 2', participacaoPct: 0.4, cotaDisponivel: false, aportes: [] },
  ],
  receita: { comissaoPct: 0.06, custoCartorioPct: 0.02, modoVenda: 'single_exit', mesSaida: 23, lucroInvestidoresPct: 0.8, lucroSponsorPct: 0.2 },
  overrides: [],
});

/** Modelagem de LOCAÇÃO, com duas facilidades e refinanciamento. */
export const locacaoDoBanco = (): ModelInput => ({
  ...vendaDoBanco(),
  nome: 'Locação',
  tipoModelagem: 'locacao',
  mesesPosObra: 18,
  unidades: [
    { nome: 'Galpão', quantidade: 1, areaSf: 45_000, aluguelSfAno: 32, custoTerreno: 1_500_000, custoObra: 9_000_000, precoVenda: 0, propertyTaxAno: 0 },
  ],
  locacao: {
    taxaReembolsoPct: 0.85,
    perdaCreditoPct: 0.1,
    capRateSaida: 0.075,
    custoVendaPct: 0.06,
    noiReferencia: 'estabilizado',
    ocupacaoEstabilizadaPct: 1,
  },
  opex: [
    { ordem: 1, label: 'Operação', valorSfAno: 9.65, reembolsavel: true },
    { ordem: 2, label: 'Reserva de reposição', valorSfAno: 2, reembolsavel: false },
  ],
  ocupacao: Array.from({ length: 18 }, (_, k) => ({ mes: 19 + k, ocupacaoPct: 1 })),
  financiamentos: [
    { ...facilidade(), ordem: 0, nome: 'Construção', mesInicioSaque: 7, mesFimSaque: 20, valorContratado: 9_000_000, modoSaque: 'equity_first_demanda', capitalizarJuros: true },
    { ...facilidade(), ordem: 1, nome: 'Permanent', mesInicioSaque: 24, mesFimSaque: 36, valorContratado: 11_000_000, modoSaque: 'manual', refinanciaIndex: 0, taxaAnual: 0.055 },
  ],
  receita: { comissaoPct: 0, custoCartorioPct: 0, modoVenda: 'single_exit', mesSaida: 36, lucroInvestidoresPct: 0.8, lucroSponsorPct: 0.2 },
});
