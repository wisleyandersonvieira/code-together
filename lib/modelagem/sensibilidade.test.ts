import { describe, expect, it } from 'vitest';
import { calcular } from './motor';
import { gradeSensibilidade, perturbar, pontosDeEquilibrio, sensibilidadePrazo } from './sensibilidade';
import type { ModelInput } from './tipos';

const casoBase = (): ModelInput => ({
  dataInicio: '2025-12-01',
  mesesAprovacao: 10,
  mesesConstrucao: 8,
  mesesPosObra: 5,
  horizonteMaximo: 60,
  unidades: [
    { nome: 'A1', quantidade: 1, custoTerreno: 25_000, custoObra: 210_000, precoVenda: 320_000, propertyTaxAno: 850 },
    { nome: 'A2', quantidade: 1, custoTerreno: 25_000, custoObra: 210_000, precoVenda: 320_000, propertyTaxAno: 850 },
    { nome: 'B1', quantidade: 1, custoTerreno: 95_000, custoObra: 460_000, precoVenda: 825_000, propertyTaxAno: 1_800 },
    { nome: 'B2', quantidade: 1, custoTerreno: 95_000, custoObra: 460_000, precoVenda: 825_000, propertyTaxAno: 1_800 },
  ],
  custosAdicionais: [
    { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros' },
  ],
  // Antes da migration 1761000000 esta premissa era a SOMA de
  // modelagem_unidades.aporte_base: 100.250 × 2 + 266.139 × 2 = 732.778. É
  // exatamente o valor que a migration semeia em modelagem_aportes.aporte_base_total,
  // e é o que mantém equityDisponivelObra em 492.778 (732.778 − 240.000 de terreno).
  aportes: {
    modoAporte: 'demanda',
    aporteBaseTotal: 732_778,
    valorTotalAlvo: 0,
  },
  financiamento: {
    taxaAnual: 0.095, feeEstruturacaoPct: 0.015, feeTiming: 'first_draw',
    mesInicioSaque: 13, mesFimSaque: 23, modoSaque: 'equity_first',
    maxLtcPct: null, valorContratado: null, custoFinanceiroNaDemanda: false,
    modoAmortizacao: 'at_exit', capitalizarJuros: false, colchaoMinimoCaixa: 0,
  },
  socios: [{ nome: 'S1', participacaoPct: 1, cotaDisponivel: false }],
  receita: {
    comissaoPct: 0.06, custoCartorioPct: 0.02, modoVenda: 'single_exit', mesSaida: 23,
    lucroInvestidoresPct: 0.8, lucroSponsorPct: 0.2,
  },
  overrides: [],
});

describe('sensibilidade', () => {
  it('a célula central da grade reproduz o caso base', () => {
    const base = calcular(casoBase());
    const grade = gradeSensibilidade(casoBase());
    const central = grade[3][1]; // preço 0%, custo 0%
    expect(central.variacaoPreco).toBe(0);
    expect(central.variacaoCusto).toBe(0);
    expect(Math.abs(central.lucroProjeto - base.apuracao.lucroProjeto)).toBeLessThanOrEqual(0.01);
  });

  it('lucro cai quando o preço cai e quando o custo sobe', () => {
    const grade = gradeSensibilidade(casoBase());
    // Linhas = preço, em ordem crescente de variação.
    for (let c = 0; c < grade[0].length; c++) {
      for (let l = 1; l < grade.length; l++) {
        expect(grade[l][c].lucroProjeto).toBeGreaterThan(grade[l - 1][c].lucroProjeto);
      }
    }
    // Colunas = custo, em ordem crescente.
    for (let l = 0; l < grade.length; l++) {
      for (let c = 1; c < grade[l].length; c++) {
        expect(grade[l][c].lucroProjeto).toBeLessThan(grade[l][c - 1].lucroProjeto);
      }
    }
  });

  it('encontra pontos de equilíbrio que realmente zeram o lucro', () => {
    const pe = pontosDeEquilibrio(casoBase());
    expect(pe.quedaMaximaPreco).not.toBeNull();
    expect(pe.altaMaximaCusto).not.toBeNull();

    const noLimitePreco = calcular(perturbar(casoBase(), 1 - pe.quedaMaximaPreco!, 1));
    expect(Math.abs(noLimitePreco.apuracao.lucroProjeto)).toBeLessThanOrEqual(1);

    const noLimiteCusto = calcular(perturbar(casoBase(), 1, 1 + pe.altaMaximaCusto!));
    expect(Math.abs(noLimiteCusto.apuracao.lucroProjeto)).toBeLessThanOrEqual(1);
  });

  it('atraso na venda corrói TIR e MOIC', () => {
    const linhas = sensibilidadePrazo(casoBase(), [0, 3, 6, 12]);
    expect(linhas.map((l) => l.prazoTotal)).toEqual([23, 26, 29, 35]);
    for (let i = 1; i < linhas.length; i++) {
      expect(linhas[i].tirAnual!).toBeLessThan(linhas[i - 1].tirAnual!);
      expect(linhas[i].moic!).toBeLessThan(linhas[i - 1].moic!);
      // Mais meses de juros e de property tax: o lucro também cai.
      expect(linhas[i].lucroProjeto).toBeLessThan(linhas[i - 1].lucroProjeto);
    }
  });
});
