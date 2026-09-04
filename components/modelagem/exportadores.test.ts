/**
 * Guarda dos exportadores: eles têm de CONSTRUIR sem estourar.
 *
 * O bug que originou este teste: a migration 1764200000 fez
 * `mapearModelInput` devolver `financiamentos` e NUNCA mais o campo único
 * `financiamento`. Um único ponto do código continuou lendo o campo antigo —
 * `sensibilidadePrazo`, em lib/modelagem/sensibilidade.ts — e ali ele era
 * `undefined`. Resultado: `TypeError` derrubando os DOIS relatórios em PDF
 * inteiros, e a aba Sensibilidade junto, em toda modelagem carregada do banco.
 *
 * Nenhum teste pegou isso porque todo input de teste do módulo usa a forma
 * ANTIGA (`financiamento: {...}`), que continua válida e é justamente a que não
 * exercita o caminho quebrado. É por isso que as fixtures aqui montam o input
 * COMO ELE VEM DO BANCO — lista de facilidades, campo único ausente —, e não
 * como é cômodo escrever à mão.
 *
 * O segundo bug que este teste pegou, este anterior a tudo: `LIMITE_ABAS_SOCIO`
 * era um `const` declarado no meio de `construirWorkbookModelagem`, DEPOIS da
 * linha que chama `abaSociosDetalhe()`. Função sobe, `const` não — e a planilha
 * estourava na zona morta temporal em toda modelagem com pelo menos um sócio.
 *
 * O que este teste NÃO cobra: o conteúdo do PDF e da planilha. Ele cobra que os
 * quatro caminhos completam. É pouco, e é exatamente o que faltava.
 */
import { describe, expect, it } from 'vitest';
import { calcular } from '@/lib/modelagem';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';
import { construirPdfModelagem } from './exportarPdf';
import { construirPdfSocios } from './exportarPdfSocios';
import { construirWorkbookModelagem } from './exportarXlsx';

/** Uma facilidade completa, no formato que o mapeador produz. */
const facilidade = (): NonNullable<ModelInput['financiamentos']>[number] => ({
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
const vendaDoBanco = (): ModelInput => ({
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
const locacaoDoBanco = (): ModelInput => ({
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

const cenarios: [string, () => ModelInput][] = [
  ['venda', vendaDoBanco],
  ['locação', locacaoDoBanco],
];

describe('exportadores — constroem sem estourar com o input como vem do banco', () => {
  for (const [rotulo, montar] of cenarios) {
    describe(rotulo, () => {
      const input = montar();
      let resultado: ModelOutput;

      it('o motor calcula', () => {
        resultado = calcular(input);
        expect(resultado.meses.length).toBeGreaterThan(0);
        // A garantia de que a fixture é mesmo a forma do banco: se alguém
        // "consertar" isto acrescentando `financiamento`, o teste deixa de
        // guardar o caminho que quebrou.
        expect(input.financiamento).toBeUndefined();
        expect(input.financiamentos?.length).toBeGreaterThan(0);
      });

      it('relatório para sócios (PDF)', () => {
        expect(() => construirPdfSocios(input, calcular(input))).not.toThrow();
      });

      it('relatório técnico (PDF)', () => {
        expect(() => construirPdfModelagem(input, calcular(input))).not.toThrow();
      });

      it('planilha Excel', async () => {
        await expect(construirWorkbookModelagem(input, calcular(input))).resolves.toBeDefined();
      });
    });
  }
});

describe('sensibilidade ao prazo — estende a janela de TODAS as facilidades', () => {
  it('não lê o campo único de financiamento', async () => {
    const { sensibilidadePrazo } = await import('@/lib/modelagem');
    const input = locacaoDoBanco();
    const linhas = sensibilidadePrazo(input, [0, 6]);
    expect(linhas).toHaveLength(2);
    // O atraso tem de mexer no prazo; se estourasse, nem chegaríamos aqui.
    expect(linhas[1].prazoTotal).toBe(linhas[0].prazoTotal + 6);
  });
});
