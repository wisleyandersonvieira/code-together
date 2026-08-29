/**
 * Critérios de aceite do motor de modelagem.
 *
 * O caso base reproduz um projeto real. Tolerância de US$ 1,00 nos valores e de
 * 0,0001 nos indicadores adimensionais.
 */
import { describe, expect, it } from 'vitest';
import { calcular } from './motor';
import { bloqueiaSalvamento } from './conferencias';
import { tirMensal, somarMeses } from './indicadores';
import type { ModelInput, Override } from './tipos';

const DOLAR = 1.0;
const RATIO = 0.0001;

const casoBase = (): ModelInput => ({
  nome: 'Caso base',
  dataInicio: '2025-12-01',
  mesesAprovacao: 10,
  mesesConstrucao: 8,
  mesesPosObra: 5,
  horizonteMaximo: 60,
  unidades: [
    { nome: 'A1', custoTerreno: 25_000, custoObra: 210_000, aporteBase: 100_250, precoVenda: 320_000, propertyTaxAno: 850 },
    { nome: 'A2', custoTerreno: 25_000, custoObra: 210_000, aporteBase: 100_250, precoVenda: 320_000, propertyTaxAno: 850 },
    { nome: 'B1', custoTerreno: 95_000, custoObra: 460_000, aporteBase: 266_139, precoVenda: 825_000, propertyTaxAno: 1_800 },
    { nome: 'B2', custoTerreno: 95_000, custoObra: 460_000, aporteBase: 266_139, precoVenda: 825_000, propertyTaxAno: 1_800 },
  ],
  custosAdicionais: [
    { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction' },
  ],
  financiamento: {
    taxaAnual: 0.095,
    feeEstruturacaoPct: 0.015,
    feeTiming: 'first_draw',
    mesInicioSaque: 13,
    mesFimSaque: 23,
    modoSaque: 'equity_first',
    maxLtcPct: null,
    valorContratado: null,
    custoFinanceiroNaDemanda: false,
    modoAmortizacao: 'at_exit',
    capitalizarJuros: false,
    colchaoMinimoCaixa: 0,
  },
  socios: [
    { nome: 'Sócio 1', participacaoPct: 0.5, cotaDisponivel: false },
    { nome: 'Sócio 2', participacaoPct: 0.5, cotaDisponivel: false },
  ],
  receita: {
    comissaoPct: 0.06,
    custoCartorioPct: 0.02,
    modoVenda: 'single_exit',
    mesSaida: 23,
    lucroInvestidoresPct: 0.8,
    lucroSponsorPct: 0.2,
  },
  overrides: [],
});

const semaforo = (out: ReturnType<typeof calcular>, chave: string) =>
  out.conferencias.find((c) => c.chave === chave)?.semaforo;

describe('caso base — projeto de 23 meses, equity_first', () => {
  const out = calcular(casoBase());
  const { apuracao: ap, indicadores: ind, cronograma: cr, agregados: ag } = out;

  it('deriva o cronograma', () => {
    expect(cr.prazoTotal).toBe(23);
    expect(cr.mesInicioObra).toBe(11);
    expect(cr.mesFimObra).toBe(18);
    expect(cr.mesSaida).toBe(23);
    expect(cr.dataInicio).toBe('2025-12-01');
    expect(cr.dataInicioObra).toBe('2026-10-01');
    expect(cr.dataFimObra).toBe('2027-05-01');
    expect(cr.dataSaida).toBe('2027-10-01');
  });

  it('agrega as unidades', () => {
    expect(ag.terrenosTotal).toBeCloseTo(240_000, 2);
    expect(ag.obraTotal).toBeCloseTo(1_340_000, 2);
    expect(ag.vgv).toBeCloseTo(2_290_000, 2);
    expect(ag.propertyTaxTotal).toBeCloseTo(10_158.33, 1);
    expect(ag.equityDisponivelObra).toBeCloseTo(492_778, 2);
  });

  it('apura custos e financiamento', () => {
    expect(ap.custoTerrenos).toBeCloseTo(240_000, 2);
    expect(ap.custoObra).toBeCloseTo(1_340_000, 2);
    expect(ap.custoPropertyTax).toBeCloseTo(10_158.33, 1);
    expect(ap.custoOutros).toBeCloseTo(56_000, 2);
    expect(Math.abs(ap.jurosTotais - 53_888.29)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.feeTotal - 12_708.33)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.custoFinanceiro - 66_596.62)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.totalPagamentos - 1_712_754.95)).toBeLessThanOrEqual(DOLAR);
  });

  it('apura dívida e equity', () => {
    expect(Math.abs(ap.dividaSacada - 847_222)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.dividaAmortizada - 847_222)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(out.meses[22].saldoDevedor)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.equityTotal - 858_384.11)).toBeLessThanOrEqual(DOLAR);
  });

  it('apura o resultado', () => {
    expect(Math.abs(ap.receitaLiquida - 2_106_800)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.lucroProjeto - 394_045.05)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.lucroInvestidores - 315_236.04)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.lucroSponsor - 78_809.01)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(ap.totalDistribuido - 1_173_620.15)).toBeLessThanOrEqual(DOLAR);
  });

  it('calcula os indicadores', () => {
    expect(Math.abs(ind.moic! - 1.3672)).toBeLessThanOrEqual(RATIO);
    expect(Math.abs(ind.roi! - 0.3672)).toBeLessThanOrEqual(RATIO);
    expect(Math.abs(ind.margemVgv! - 0.1721)).toBeLessThanOrEqual(RATIO);
    expect(Math.abs(ind.ltc! - 0.5362)).toBeLessThanOrEqual(RATIO);
    expect(Math.abs(ind.tirMensal! - 0.022752)).toBeLessThanOrEqual(RATIO);
    expect(Math.abs(ind.tirAnual! - 0.3099)).toBeLessThanOrEqual(RATIO);
  });

  it('lança os saques esperados do modo equity_first', () => {
    const saques = out.meses.map((m) => m.draw);
    expect(Math.abs(saques[12] - 9_722)).toBeLessThanOrEqual(DOLAR);
    for (const m of [13, 14, 15, 16, 17]) {
      expect(Math.abs(saques[m] - 167_500)).toBeLessThanOrEqual(DOLAR);
    }
    for (const m of [0, 9, 10, 11, 18, 19, 20, 21, 22]) {
      expect(saques[m]).toBeCloseTo(0, 6);
    }
  });

  it('lança os aportes de equity esperados nos 23 meses', () => {
    const esperado = [
      240_441.67, 441.67, 441.67, 441.67, 441.67, 441.67, 441.67, 441.67, 441.67, 441.67,
      174_941.67, 174_941.67, 178_004.96, 8_844.67, 10_170.72, 11_496.76, 12_822.80,
      14_148.84, 7_148.84, 7_148.84, 7_148.84, 7_148.84, 0,
    ];
    expect(out.meses).toHaveLength(23);
    out.meses.forEach((m, i) => {
      expect(Math.abs(m.equityCall - esperado[i])).toBeLessThanOrEqual(DOLAR);
    });
  });

  it('o mês 23 não chama capital porque a receita da venda entra no mesmo mês', () => {
    const m23 = out.meses[22];
    expect(m23.equityCall).toBeCloseTo(0, 6);
    // 441,67 de property tax + 6.707,17 de juros, cobertos pela receita.
    expect(Math.abs(m23.pagamentos - 7_148.84)).toBeLessThanOrEqual(DOLAR);
    expect(m23.revenue).toBeGreaterThan(2_000_000);
  });

  it('lança o saldo devedor esperado', () => {
    const esperado: Record<number, number> = {
      13: 9_722, 14: 177_222, 15: 344_722, 16: 512_222, 17: 679_722,
      18: 847_222, 19: 847_222, 20: 847_222, 21: 847_222, 22: 847_222, 23: 0,
    };
    for (const [mes, valor] of Object.entries(esperado)) {
      const linha = out.meses[Number(mes) - 1];
      expect(Math.abs(linha.saldoDevedor - valor)).toBeLessThanOrEqual(DOLAR);
    }
  });

  it('fecha o caixa: mínimo zero e final igual ao lucro do sponsor', () => {
    const caixaMinimo = Math.min(...out.meses.map((m) => m.caixaAcumulado));
    expect(Math.abs(caixaMinimo)).toBeLessThanOrEqual(DOLAR);
    const caixaFinal = out.meses[22].caixaAcumulado;
    expect(Math.abs(caixaFinal - 78_809.01)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(caixaFinal - ap.lucroSponsor)).toBeLessThanOrEqual(DOLAR);
  });

  it('rateia entre os sócios pro-rata, com indicadores idênticos', () => {
    const [s1, s2] = out.rateioSocios;
    expect(Math.abs(s1.capital - ap.equityTotal / 2)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(s1.lucro - ap.lucroInvestidores / 2)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(s1.total - s2.total)).toBeLessThanOrEqual(DOLAR);
    // O que varia entre sócios é só a escala.
    expect(s1.total / s1.capital).toBeCloseTo(s2.total / s2.capital, 9);
  });

  it('soma o lucro das unidades igual ao lucro do projeto', () => {
    const somaUnidades = out.resultadoUnidades.reduce((a, u) => a + u.lucro, 0);
    expect(Math.abs(somaUnidades - ap.lucroProjeto)).toBeLessThanOrEqual(DOLAR);
  });

  it('passa em todas as conferências', () => {
    // O caso base não define teto de dívida (nem LTC, nem valor contratado), e a
    // conferência de teto acende âmbar de propósito nessa situação: ela avisa que
    // não há limite configurado, não que algo estourou.
    expect(out.conferencias.filter((c) => c.semaforo === 'vermelho')).toEqual([]);
    const ambares = out.conferencias.filter((c) => c.semaforo === 'ambar');
    expect(ambares.map((c) => c.chave)).toEqual(['teto_divida']);
    expect(ambares[0].detalhe).toContain('Nenhum teto definido');
  });

  it('converge', () => {
    expect(out.convergiu).toBe(true);
    expect(out.iteracoes).toBeLessThanOrEqual(5);
  });
});

describe('1 — override de aporte', () => {
  const base = casoBase();
  base.overrides = [{ mes: 1, linha: 'equity_call', valor: 500_000 }];
  const out = calcular(base);
  const semOverride = calcular(casoBase());

  it('o caixa do mês 1 sobe na mesma medida do override', () => {
    // 500.000 aportados contra 240.441,67 de pagamentos.
    expect(Math.abs(out.meses[0].caixaAcumulado - 259_558.33)).toBeLessThanOrEqual(DOLAR);
  });

  it('antecipa o capital sem mudar o equity total nem a apuração', () => {
    // Propriedade do plugue da fórmula 6: aportar 500.000 no mês 1 só ADIANTA o
    // capital. Os meses seguintes consomem a sobra de caixa e chamam menos, na
    // mesma medida. O total aportado é invariante — o que muda é o calendário.
    expect(Math.abs(out.apuracao.equityTotal - semOverride.apuracao.equityTotal)).toBeLessThanOrEqual(0.01);
    expect(out.meses[1].equityCall).toBeCloseTo(0, 6);
    expect(Math.abs(out.meses[11].equityCall - 94_300)).toBeLessThanOrEqual(DOLAR);
    // O lucro não depende de COMO o caixa foi financiado.
    expect(Math.abs(out.apuracao.lucroProjeto - semOverride.apuracao.lucroProjeto)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(out.apuracao.custoFinanceiro - semOverride.apuracao.custoFinanceiro)).toBeLessThanOrEqual(0.01);
  });

  it('piora a TIR porque o capital entra mais cedo, sem mexer no MOIC', () => {
    expect(Math.abs(out.indicadores.moic! - semOverride.indicadores.moic!)).toBeLessThanOrEqual(RATIO);
    expect(out.indicadores.tirMensal!).toBeLessThan(semOverride.indicadores.tirMensal!);
    expect(Math.abs(out.indicadores.tirMensal! - 0.018551)).toBeLessThanOrEqual(RATIO);
  });

  it('conta a célula manual e não quebra as conferências estruturais', () => {
    expect(out.celulasManuais).toBe(1);
    expect(semaforo(out, 'saldo_devedor_final')).toBe('verde');
    expect(semaforo(out, 'caixa_minimo')).toBe('verde');
  });
});

describe('2 — caixa negativo', () => {
  const base = casoBase();
  base.overrides = [
    { mes: 1, linha: 'equity_call', valor: 0 },
    { mes: 2, linha: 'equity_call', valor: 0 },
  ];
  const out = calcular(base);

  it('deixa o caixa mínimo negativo', () => {
    const caixaMinimo = Math.min(...out.meses.map((m) => m.caixaAcumulado));
    expect(caixaMinimo).toBeLessThan(0);
    expect(Math.abs(caixaMinimo + 240_883.33)).toBeLessThanOrEqual(DOLAR);
  });

  it('acusa vermelho na conferência de caixa, sem lançar exceção', () => {
    expect(semaforo(out, 'caixa_minimo')).toBe('vermelho');
    expect(out.apuracao.lucroProjeto).toBeGreaterThan(0);
  });
});

describe('3 — modo cash_demand', () => {
  const comLtc = (colchao: number) => {
    const base = casoBase();
    base.financiamento.modoSaque = 'cash_demand';
    base.financiamento.maxLtcPct = 0.55;
    base.financiamento.colchaoMinimoCaixa = colchao;
    return calcular(base);
  };

  it('satura exatamente no teto de LTC e quita a dívida', () => {
    const out = comLtc(0);
    const teto = 0.55 * (240_000 + 1_340_000);
    expect(teto).toBeCloseTo(869_000, 2);
    expect(Math.abs(out.apuracao.dividaSacada - 869_000)).toBeLessThanOrEqual(DOLAR);
    expect(out.apuracao.dividaSacada).toBeLessThanOrEqual(teto + DOLAR);
    expect(Math.abs(out.meses[22].saldoDevedor)).toBeLessThanOrEqual(DOLAR);
    expect(semaforo(out, 'teto_divida')).toBe('verde');
  });

  it('reduz o equity total em relação ao equity_first', () => {
    const out = comLtc(0);
    const base = calcular(casoBase());
    expect(out.apuracao.equityTotal).toBeLessThan(base.apuracao.equityTotal);
    expect(Math.abs(out.apuracao.equityTotal - 844_878.72)).toBeLessThanOrEqual(DOLAR);
  });

  it('mantém o caixa no colchão configurado', () => {
    expect(Math.min(...comLtc(0).meses.map((m) => m.caixaAcumulado))).toBeGreaterThanOrEqual(-DOLAR);
    const comColchao = comLtc(50_000);
    const minimo = Math.min(...comColchao.meses.map((m) => m.caixaAcumulado));
    expect(Math.abs(minimo - 50_000)).toBeLessThanOrEqual(DOLAR);
    expect(semaforo(comColchao, 'caixa_minimo')).toBe('verde');
  });

  it('com override de aporte o colchão pode ser furado, e a conferência acusa', () => {
    // Sem esse caso a asserção de colchão é vacuamente verdadeira: o aporte de
    // equity é um plugue que mantém o caixa no colchão por construção.
    const base = casoBase();
    base.financiamento.modoSaque = 'cash_demand';
    base.financiamento.maxLtcPct = 0.55;
    base.financiamento.colchaoMinimoCaixa = 50_000;
    base.overrides = [{ mes: 1, linha: 'equity_call', valor: 0 }];
    const out = calcular(base);
    expect(Math.min(...out.meses.map((m) => m.caixaAcumulado))).toBeLessThan(50_000);
    expect(semaforo(out, 'caixa_minimo')).not.toBe('verde');
  });
});

describe('4 — prazo alterado', () => {
  const base = casoBase();
  base.mesesConstrucao = 12;
  base.receita.mesSaida = 27;
  base.financiamento.mesFimSaque = 27;
  const out = calcular(base);

  it('redistribui a obra e estende o cronograma', () => {
    expect(out.cronograma.prazoTotal).toBe(27);
    expect(out.cronograma.mesFimObra).toBe(22);
    expect(out.meses).toHaveLength(27);
    const mesesComObra = out.meses.filter((m) => m.construction > 0);
    expect(mesesComObra).toHaveLength(12);
    for (const m of mesesComObra) {
      expect(Math.abs(m.construction - 1_340_000 / 12)).toBeLessThanOrEqual(DOLAR);
    }
    expect(Math.abs(out.apuracao.custoObra - 1_340_000)).toBeLessThanOrEqual(DOLAR);
  });

  it('estende a curva de juros e mantém as datas coerentes', () => {
    expect(out.apuracao.jurosTotais).toBeGreaterThan(0);
    expect(Math.abs(out.meses[26].saldoDevedor)).toBeLessThanOrEqual(DOLAR);
    expect(out.meses[26].data).toBe(somarMeses('2025-12-01', 26));
    expect(out.meses.every((m) => m.data === somarMeses('2025-12-01', m.mes - 1))).toBe(true);
  });
});

describe('5 — overrides órfãos', () => {
  const override: Override = { mes: 26, linha: 'other_costs', valor: 9_999 };

  it('some do cálculo quando o prazo encurta, e acusa âmbar', () => {
    const curto = casoBase();
    curto.overrides = [override];
    const out = calcular(curto);
    expect(out.overridesOrfaos).toHaveLength(1);
    expect(out.celulasManuais).toBe(0);
    expect(semaforo(out, 'overrides_orfaos')).toBe('ambar');
    expect(Math.abs(out.apuracao.custoOutros - 56_000)).toBeLessThanOrEqual(DOLAR);
  });

  it('volta a valer quando o prazo aumenta', () => {
    const longo = casoBase();
    longo.mesesConstrucao = 12;
    longo.receita.mesSaida = 27;
    longo.financiamento.mesFimSaque = 27;
    longo.overrides = [override];
    const out = calcular(longo);
    expect(out.overridesOrfaos).toHaveLength(0);
    expect(out.celulasManuais).toBe(1);
    expect(Math.abs(out.apuracao.custoOutros - (56_000 + 9_999))).toBeLessThanOrEqual(DOLAR);
  });
});

describe('6 — validação de sócios', () => {
  const base = casoBase();
  base.socios = [
    { nome: 'Sócio 1', participacaoPct: 0.5, cotaDisponivel: false },
    { nome: 'Sócio 2', participacaoPct: 0.49, cotaDisponivel: false },
  ];
  const out = calcular(base);

  it('bloqueia o salvamento com 99%', () => {
    expect(semaforo(out, 'soma_participacoes')).toBe('vermelho');
    const bloqueios = bloqueiaSalvamento(out.conferencias);
    expect(bloqueios).toHaveLength(1);
    expect(bloqueios[0].chave).toBe('soma_participacoes');
  });

  it('mas não bloqueia o cálculo', () => {
    expect(Math.abs(out.apuracao.lucroProjeto - 394_045.05)).toBeLessThanOrEqual(DOLAR);
    expect(out.rateioSocios).toHaveLength(2);
  });
});

describe('7 e 8 — TIR sem raiz', () => {
  it('devolve null quando o fluxo é só negativo', () => {
    expect(tirMensal([-100, -100, -100])).toBeNull();
    expect(tirMensal([-100, -100, -100])).not.toBeNaN();
  });

  it('devolve null quando a TIR passa de 100% ao mês', () => {
    // -1 no mês 1 e +1.000 no mês 2 dá TIR mensal de 999% — fora do intervalo
    // de bisseção. Tem de virar "n/d", não o extremo do intervalo.
    expect(tirMensal([-1, 1_000])).toBeNull();
  });

  it('devolve null no output quando não há distribuição nenhuma', () => {
    const base = casoBase();
    base.receita.modoVenda = 'manual';
    base.overrides = [{ mes: 23, linha: 'distribution', valor: 0 }];
    const out = calcular(base);
    expect(out.indicadores.tirMensal).toBeNull();
    expect(out.indicadores.tirAnual).toBeNull();
  });
});

describe('9 — determinismo', () => {
  it('devolve exatamente o mesmo output em duas rodadas', () => {
    const a = calcular(casoBase());
    const b = calcular(casoBase());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('datas', () => {
  it('soma meses sem estourar o fim do mês', () => {
    expect(somarMeses('2025-01-31', 1)).toBe('2025-02-28');
    expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29');
    expect(somarMeses('2025-12-01', 1)).toBe('2026-01-01');
    expect(somarMeses('2025-03-31', -1)).toBe('2025-02-28');
  });
});
