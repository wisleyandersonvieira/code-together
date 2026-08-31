/**
 * Critérios de aceite do motor de modelagem.
 *
 * O caso base reproduz um projeto real. Tolerância de US$ 1,00 nos valores e de
 * 0,0001 nos indicadores adimensionais.
 */
import { describe, expect, it } from 'vitest';
import { basesDeCalculo, calcular, resolverCustos, valorEfetivoCusto } from './motor';
import { bloqueiaSalvamento } from './conferencias';
import { indiceMes, tirMensal, somarMeses } from './indicadores';
import { comParcelaNoMes, curvaComoParcelas, editaPlanoDeAportes, semParcelaNoMes } from './aportes';
import { mapearModelInput } from './mapear';
import { CATEGORIAS_CUSTO } from './tipos';
import type { CustoAdicional, ModelInput, Override } from './tipos';

const DOLAR = 1.0;
const RATIO = 0.0001;

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const casoBase = (): ModelInput => ({
  nome: 'Caso base',
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
    // `categoria: 'outros'` é o DEFAULT da coluna criada pela migration 1761200000
    // e é justamente o que toda linha já gravada recebe. O caso base continua
    // sendo, portanto, o mesmo caso base de antes da categorização.
    { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
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

describe('10 — quantidade por tipologia', () => {
  // O MESMO projeto descrito de duas formas: 4 linhas de 1 unidade, ou 2
  // tipologias de 2 unidades com os mesmos valores UNITÁRIOS. Se a quantidade
  // estiver entrando em todo lugar que precisa, os dois modelos têm de ser
  // indistinguíveis — é isso que este bloco cobra.
  const duasTipologias = (): ModelInput => {
    const base = casoBase();
    base.unidades = [
      { nome: 'A', quantidade: 2, custoTerreno: 25_000, custoObra: 210_000, precoVenda: 320_000, propertyTaxAno: 850 },
      { nome: 'B', quantidade: 2, custoTerreno: 95_000, custoObra: 460_000, precoVenda: 825_000, propertyTaxAno: 1_800 },
    ];
    return base;
  };

  const quatro = calcular(casoBase());
  const duas = calcular(duasTipologias());

  /**
   * Compara todos os campos de um bloco do output. Numérico finito por
   * tolerância; o resto por igualdade estrita, porque tetoDivida pode ser
   * Infinity e indicadores podem ser null — e ambos têm de bater assim mesmo.
   */
  const mesmosCampos = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    expect(Object.keys(b)).toEqual(Object.keys(a));
    for (const k of Object.keys(a)) {
      const x = a[k];
      if (typeof x === 'number' && Number.isFinite(x)) {
        expect(Math.abs((b[k] as number) - x)).toBeLessThanOrEqual(1e-6);
      } else {
        expect(b[k]).toEqual(x);
      }
    }
  };

  it('agrega igual, contando 4 unidades em 2 linhas', () => {
    mesmosCampos(quatro.agregados, duas.agregados);
    expect(duas.agregados.unidadesTotal).toBe(4);
    expect(duas.agregados.terrenosTotal).toBeCloseTo(240_000, 2);
    expect(duas.agregados.obraTotal).toBeCloseTo(1_340_000, 2);
    expect(duas.agregados.vgv).toBeCloseTo(2_290_000, 2);
    expect(duas.agregados.taxAnoTotal).toBeCloseTo(5_300, 2);
  });

  it('apura igual', () => {
    mesmosCampos(quatro.apuracao, duas.apuracao);
  });

  it('calcula os mesmos indicadores', () => {
    mesmosCampos(quatro.indicadores, duas.indicadores);
  });

  it('produz o mesmo fluxo mensal, mês a mês', () => {
    expect(JSON.stringify(duas.meses)).toBe(JSON.stringify(quatro.meses));
  });

  it('mantém Σ lucro das tipologias = lucro do projeto', () => {
    expect(duas.resultadoUnidades).toHaveLength(2);
    const somaTipologias = duas.resultadoUnidades.reduce((a, u) => a + u.lucro, 0);
    expect(Math.abs(somaTipologias - duas.apuracao.lucroProjeto)).toBeLessThanOrEqual(DOLAR);
  });

  it('devolve o resultado da tipologia como total, com o unitário ao lado', () => {
    const [a, b] = duas.resultadoUnidades;
    // A tipologia A tem de agregar exatamente as linhas A1 e A2 do caso de 4.
    const [a1, a2] = quatro.resultadoUnidades;
    expect(a.quantidade).toBe(2);
    expect(b.quantidade).toBe(2);
    expect(Math.abs(a.custoTerreno - (a1.custoTerreno + a2.custoTerreno))).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(a.custoObra - (a1.custoObra + a2.custoObra))).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(a.custoTotal - (a1.custoTotal + a2.custoTotal))).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(a.lucro - (a1.lucro + a2.lucro))).toBeLessThanOrEqual(1e-6);
    // O unitário volta a ser exatamente a linha solta do caso de 4.
    expect(Math.abs(a.custoTotalUnitario - a1.custoTotal)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(a.receitaLiquidaUnitaria - a1.receitaLiquida)).toBeLessThanOrEqual(1e-6);
    // Margem é adimensional: idêntica na tipologia e na unidade solta.
    expect(Math.abs(a.margem! - a1.margem!)).toBeLessThanOrEqual(1e-9);
  });

  it('no modo per_unit a tipologia inteira vende no mês declarado', () => {
    const base = duasTipologias();
    base.receita.modoVenda = 'per_unit';
    base.receita.vendasPorUnidade = [
      { unidadeIndex: 0, mesVenda: 20 },
      { unidadeIndex: 1, mesVenda: 23 },
    ];
    const out = calcular(base);
    const fatorLiquido = 1 - 0.06 - 0.02;
    // 2 × 320.000 no mês 20 e 2 × 825.000 no mês 23, líquidos.
    expect(Math.abs(out.meses[19].revenue - 640_000 * fatorLiquido)).toBeLessThanOrEqual(DOLAR);
    expect(Math.abs(out.meses[22].revenue - 1_650_000 * fatorLiquido)).toBeLessThanOrEqual(DOLAR);
  });

  it('trata quantidade inválida como 1, sem lançar exceção', () => {
    // Input inconsistente nunca estoura: 0, negativo e fracionário caem no piso.
    const base = duasTipologias();
    base.unidades = base.unidades.map((u) => ({ ...u, quantidade: 0 }));
    const zerado = calcular(base);
    expect(zerado.agregados.unidadesTotal).toBe(2);
    expect(zerado.agregados.terrenosTotal).toBeCloseTo(120_000, 2);
    expect(Number.isFinite(zerado.apuracao.lucroProjeto)).toBe(true);
  });
});

describe('11 — plano de aportes', () => {
  /** Três chamadas de 300.000 nos meses 1, 6 e 12. */
  const comPlano = (modo: 'demanda' | 'plano'): ModelInput => {
    const base = casoBase();
    base.aportes = {
      modoAporte: modo,
      aporteBaseTotal: 732_778,
      valorTotalAlvo: 900_000,
      parcelas: [
        { mes: 1, valor: 300_000 },
        { mes: 6, valor: 300_000 },
        { mes: 12, valor: 300_000 },
      ],
    };
    return base;
  };

  it('no modo demanda as parcelas ficam guardadas e não mudam nada no fluxo', () => {
    // Esta é a garantia de compatibilidade: congelar uma curva sem virar a chave
    // não pode alterar resultado nenhum de modelagem já salva.
    const semPlano = calcular(casoBase());
    const guardado = calcular(comPlano('demanda'));
    expect(JSON.stringify(guardado.meses)).toBe(JSON.stringify(semPlano.meses));
    expect(guardado.apuracao.equityTotal).toBeCloseTo(semPlano.apuracao.equityTotal, 6);
  });

  it('expõe o total planejado mesmo no modo demanda', () => {
    expect(calcular(comPlano('demanda')).agregados.aportePlanejadoTotal).toBeCloseTo(900_000, 2);
  });

  it('no modo demanda o equity disponível para obra é constante em todos os meses', () => {
    const out = calcular(comPlano('demanda'));
    for (const m of out.meses) {
      expect(m.equityDisponivelAcumulado).toBeCloseTo(out.agregados.equityDisponivelObra, 6);
    }
    expect(out.agregados.equityDisponivelObra).toBeCloseTo(492_778, 2);
  });

  it('no modo plano o aporte do mês é a parcela, e zero onde não há parcela', () => {
    const out = calcular(comPlano('plano'));
    const esperado = new Map([
      [1, 300_000],
      [6, 300_000],
      [12, 300_000],
    ]);
    for (const m of out.meses) {
      expect(m.equityCall).toBeCloseTo(esperado.get(m.mes) ?? 0, 6);
    }
    expect(out.apuracao.equityTotal).toBeCloseTo(900_000, 2);
  });

  it('no modo plano o equity disponível vira curva, descontado o terreno', () => {
    const out = calcular(comPlano('plano'));
    const ate = (mes: number) => out.meses[mes - 1].equityDisponivelAcumulado;
    // 240.000 de terreno consomem a primeira parcela quase toda.
    expect(ate(1)).toBeCloseTo(60_000, 2);
    expect(ate(5)).toBeCloseTo(60_000, 2);
    expect(ate(6)).toBeCloseTo(360_000, 2);
    expect(ate(12)).toBeCloseTo(660_000, 2);
    expect(ate(23)).toBeCloseTo(660_000, 2);
  });

  it('o saque equity_first passa a comparar com o capital que já entrou', () => {
    // Todo o capital no mês 1: o equity cobre terreno e obra inteira, e o
    // financiamento nunca é acionado.
    const cedo = comPlano('plano');
    cedo.aportes!.parcelas = [{ mes: 1, valor: 2_000_000 }];
    expect(calcular(cedo).apuracao.dividaSacada).toBeCloseTo(0, 2);

    // O MESMO capital, só que no fim: durante a obra não há equity nenhum
    // disponível, então a dívida entra.
    const tarde = comPlano('plano');
    tarde.aportes!.parcelas = [{ mes: 23, valor: 2_000_000 }];
    expect(calcular(tarde).apuracao.dividaSacada).toBeGreaterThan(0);
  });

  it('override na linha de aporte continua vencendo o plano', () => {
    const base = comPlano('plano');
    base.overrides = [{ mes: 6, linha: 'equity_call', valor: 111 }];
    const out = calcular(base);
    expect(out.meses[5].equityCall).toBeCloseTo(111, 6);
    expect(semaforo(out, 'aporte_override_no_plano')).toBe('ambar');
  });

  it('plano que não cobre a demanda deixa o caixa negativo, e a conferência acusa', () => {
    const base = comPlano('plano');
    base.aportes!.parcelas = [{ mes: 1, valor: 300_000 }];
    const out = calcular(base);
    expect(Math.min(...out.meses.map((m) => m.caixaAcumulado))).toBeLessThan(0);
    expect(semaforo(out, 'caixa_minimo')).toBe('vermelho');
  });

  it('converge no modo plano', () => {
    const out = calcular(comPlano('plano'));
    expect(out.convergiu).toBe(true);
    // O equity deixa de ser função do caixa: o ponto fixo tende a fechar em menos
    // passadas, nunca em mais.
    expect(out.iteracoes).toBeLessThanOrEqual(calcular(casoBase()).iteracoes);
  });

  it('acende âmbar quando as parcelas não somam o alvo declarado', () => {
    const base = comPlano('plano');
    expect(semaforo(calcular(base), 'aporte_plano_vs_alvo')).toBe('verde');
    base.aportes!.valorTotalAlvo = 1_000_000;
    expect(semaforo(calcular(base), 'aporte_plano_vs_alvo')).toBe('ambar');
  });

  it('acusa parcela fora do prazo sem descartá-la do total planejado', () => {
    const base = comPlano('plano');
    base.aportes!.parcelas = [...base.aportes!.parcelas!, { mes: 99, valor: 50_000 }];
    const out = calcular(base);
    expect(semaforo(out, 'aporte_parcela_fora_prazo')).toBe('ambar');
    expect(out.agregados.aportePlanejadoTotal).toBeCloseTo(950_000, 2);
    // Fora do prazo, a parcela não é lançada em mês nenhum.
    expect(out.apuracao.equityTotal).toBeCloseTo(900_000, 2);
  });

  it('não estoura com parcela em mês inválido', () => {
    const base = comPlano('plano');
    base.aportes!.parcelas = [{ mes: 0, valor: 10 }, { mes: -3, valor: 10 }];
    const out = calcular(base);
    expect(out.apuracao.equityTotal).toBeCloseTo(0, 6);
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
  });
});

describe('12 — fases', () => {
  // Janela de obra do caso base: mês 11 (2026-10) ao 18 (2027-05).
  const FASE_A = { ordem: 0, nome: 'Fase 1', dataInicio: '2026-10-01', dataFim: '2027-01-01' };
  const FASE_B = { ordem: 1, nome: 'Fase 2', dataInicio: '2027-02-01', dataFim: '2027-05-01' };

  /**
   * Aloca todas as unidades entre as fases em rodízio. Com as 4 tipologias do
   * caso base (A1, A2, B1, B2) e 2 fases isso dá exatamente metade da obra em
   * cada uma — o que torna o ladrilhamento perfeito comparável com a frente única.
   */
  const alocacaoCheia = (nUnidades: number, nFases: number) =>
    nFases === 0
      ? []
      : Array.from({ length: nUnidades }, (_, i) => ({
          unidadeIndex: i,
          faseIndex: i % nFases,
          quantidade: 1,
        }));

  const comFases = (
    fases: ModelInput['fases'],
    usa = true,
    alocacoes?: ModelInput['alocacoes'],
  ): ModelInput => {
    const base = casoBase();
    base.usaFases = usa;
    base.fases = fases;
    base.alocacoes = alocacoes ?? alocacaoCheia(base.unidades.length, fases?.length ?? 0);
    return base;
  };

  it('deriva o índice do mês a partir das datas, contando mês calendário', () => {
    expect(indiceMes('2025-12-01', '2025-12-01')).toBe(1);
    expect(indiceMes('2025-12-01', '2025-12-31')).toBe(1);
    expect(indiceMes('2025-12-01', '2026-01-01')).toBe(2);
    expect(indiceMes('2025-12-15', '2026-01-02')).toBe(2);
    expect(indiceMes('2025-12-01', '2026-10-01')).toBe(11);
    // Antes do início devolve índice ≤ 0 em vez de mentir.
    expect(indiceMes('2025-12-01', '2025-11-01')).toBe(0);
  });

  it('com usaFases desligado, fase cadastrada não muda absolutamente nada', () => {
    // Este é o caminho de toda modelagem existente e tem de ficar idêntico.
    const semFases = calcular(casoBase());
    const desligado = calcular(comFases([FASE_A, FASE_B], false));
    expect(JSON.stringify(desligado.meses)).toBe(JSON.stringify(semFases.meses));
    expect(desligado.cronograma.fases).toHaveLength(2);
  });

  it('fases que ladrilham a janela de obra reproduzem a curva de frente única', () => {
    const semFases = calcular(casoBase());
    const faseado = calcular(comFases([FASE_A, FASE_B]));
    expect(JSON.stringify(faseado.meses)).toBe(JSON.stringify(semFases.meses));
    expect(semaforo(faseado, 'fases_sobrepostas')).toBe('verde');
    expect(semaforo(faseado, 'fases_com_buraco')).toBe('verde');
    expect(semaforo(faseado, 'fases_dentro_prazo')).toBe('verde');
    expect(semaforo(faseado, 'alocacao_fases')).toBe('verde');
  });

  it('usaFases sem nenhuma fase cai no caminho de frente única e acende âmbar', () => {
    const semLinha = calcular(comFases([]));
    expect(JSON.stringify(semLinha.meses)).toBe(JSON.stringify(calcular(casoBase()).meses));
    expect(semaforo(semLinha, 'fases_sem_linha')).toBe('ambar');
  });

  it('distribui a obra dentro da janela de cada fase', () => {
    // Fase 1 nos meses 11-12 e fase 2 nos meses 17-18: a obra deixa de ocupar os
    // 8 meses de construção e se concentra em 4.
    const out = calcular(
      comFases([
        { ordem: 0, nome: 'A', dataInicio: '2026-10-01', dataFim: '2026-11-01' },
        { ordem: 1, nome: 'B', dataInicio: '2027-04-01', dataFim: '2027-05-01' },
      ]),
    );
    const obra = out.meses.map((m) => m.construction);
    const total = obra.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(out.agregados.obraTotal, 2);
    // Metade em cada fase (durações iguais), dividida pelos 2 meses da fase.
    expect(obra[10]).toBeCloseTo(out.agregados.obraTotal / 4, 2);
    expect(obra[11]).toBeCloseTo(out.agregados.obraTotal / 4, 2);
    expect(obra[12]).toBeCloseTo(0, 6);
    expect(obra[16]).toBeCloseTo(out.agregados.obraTotal / 4, 2);
    expect(obra[17]).toBeCloseTo(out.agregados.obraTotal / 4, 2);
  });

  it('com terrenoPorFase o terreno entra no início de cada fase, sem sumir', () => {
    const base = comFases([FASE_A, FASE_B]);
    base.terrenoPorFase = true;
    const out = calcular(base);
    const land = out.meses.map((m) => m.land);
    expect(land[0]).toBeCloseTo(0, 6);
    expect(land[10]).toBeCloseTo(120_000, 2);
    expect(land[14]).toBeCloseTo(120_000, 2);
    expect(land.reduce((a, b) => a + b, 0)).toBeCloseTo(out.agregados.terrenosTotal, 2);
  });

  it('fase que estoura o prazo acende vermelho e não perde custo', () => {
    const out = calcular(
      comFases([FASE_A, { ordem: 1, nome: 'B', dataInicio: '2027-02-01', dataFim: '2028-05-01' }]),
    );
    expect(semaforo(out, 'fases_dentro_prazo')).toBe('vermelho');
    const total = out.meses.reduce((a, m) => a + m.construction, 0);
    expect(total).toBeCloseTo(out.agregados.obraTotal, 2);
  });

  it('acusa sobreposição, buraco e fase invertida', () => {
    const sobrepostas = calcular(
      comFases([
        { ordem: 0, nome: 'A', dataInicio: '2026-10-01', dataFim: '2027-02-01' },
        { ordem: 1, nome: 'B', dataInicio: '2027-01-01', dataFim: '2027-05-01' },
      ]),
    );
    expect(semaforo(sobrepostas, 'fases_sobrepostas')).toBe('ambar');

    const comBuraco = calcular(
      comFases([
        { ordem: 0, nome: 'A', dataInicio: '2026-10-01', dataFim: '2026-12-01' },
        { ordem: 1, nome: 'B', dataInicio: '2027-03-01', dataFim: '2027-05-01' },
      ]),
    );
    expect(semaforo(comBuraco, 'fases_com_buraco')).toBe('ambar');
    expect(semaforo(comBuraco, 'fases_sobrepostas')).toBe('verde');

    const invertida = calcular(
      comFases([{ ordem: 0, nome: 'A', dataInicio: '2027-05-01', dataFim: '2026-10-01' }]),
    );
    // Uma fase só: o rodízio aloca as 4 tipologias nela.
    expect(semaforo(invertida, 'alocacao_fases')).toBe('verde');
    expect(semaforo(invertida, 'fase_invertida')).toBe('vermelho');
    // Nem por isso o cálculo para: o custo cai no mês de início.
    expect(Number.isFinite(invertida.apuracao.lucroProjeto)).toBe(true);
  });

  it('não gera conferência de fase nenhuma com o switch desligado', () => {
    const out = calcular(comFases([FASE_A, FASE_B], false));
    for (const chave of [
      'fases_sem_linha',
      'fase_invertida',
      'fases_dentro_prazo',
      'fases_sobrepostas',
      'fases_com_buraco',
      'alocacao_fases',
    ]) {
      expect(semaforo(out, chave)).toBeUndefined();
    }
  });
});

describe('13 — alocação de unidades por fase', () => {
  const duasFases = [
    { ordem: 0, nome: 'Fase 1', dataInicio: '2026-10-01', dataFim: '2027-01-01' },
    { ordem: 1, nome: 'Fase 2', dataInicio: '2027-02-01', dataFim: '2027-05-01' },
  ];

  const faseado = (alocacoes: ModelInput['alocacoes']): ModelInput => {
    const base = casoBase();
    base.usaFases = true;
    base.fases = duasFases;
    base.alocacoes = alocacoes;
    return base;
  };

  it('a obra de cada fase é Σ custoObra × quantidade alocada', () => {
    // A1 e A2 (210.000 cada) na fase 1; B1 e B2 (460.000 cada) na fase 2.
    const out = calcular(
      faseado([
        { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
        { unidadeIndex: 3, faseIndex: 1, quantidade: 1 },
      ]),
    );
    const obra = out.meses.map((m) => m.construction);
    // Fase 1: 420.000 em 4 meses (11 a 14). Fase 2: 920.000 em 4 meses (15 a 18).
    for (const m of [11, 12, 13, 14]) expect(obra[m - 1]).toBeCloseTo(105_000, 2);
    for (const m of [15, 16, 17, 18]) expect(obra[m - 1]).toBeCloseTo(230_000, 2);
    expect(obra.reduce((a, b) => a + b, 0)).toBeCloseTo(out.agregados.obraTotal, 2);
    expect(semaforo(out, 'alocacao_fases')).toBe('verde');
  });

  it('com terrenoPorFase o terreno segue a mesma alocação', () => {
    const base = faseado([
      { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
      { unidadeIndex: 3, faseIndex: 1, quantidade: 1 },
    ]);
    base.terrenoPorFase = true;
    const land = calcular(base).meses.map((m) => m.land);
    expect(land[10]).toBeCloseTo(50_000, 2); // A1 + A2
    expect(land[14]).toBeCloseTo(190_000, 2); // B1 + B2
    expect(land.reduce((a, b) => a + b, 0)).toBeCloseTo(240_000, 2);
  });

  it('reparte a quantidade de uma tipologia entre fases', () => {
    const base = casoBase();
    base.unidades = [
      { nome: 'A', quantidade: 4, custoTerreno: 25_000, custoObra: 210_000, precoVenda: 320_000, propertyTaxAno: 850 },
    ];
    base.usaFases = true;
    base.fases = duasFases;
    base.alocacoes = [
      { unidadeIndex: 0, faseIndex: 0, quantidade: 3 },
      { unidadeIndex: 0, faseIndex: 1, quantidade: 1 },
    ];
    const out = calcular(base);
    expect(semaforo(out, 'alocacao_fases')).toBe('verde');
    const obra = out.meses.map((m) => m.construction);
    // 3 × 210.000 em 4 meses, depois 1 × 210.000 em 4 meses.
    expect(obra[10]).toBeCloseTo((3 * 210_000) / 4, 2);
    expect(obra[14]).toBeCloseTo(210_000 / 4, 2);
    expect(obra.reduce((a, b) => a + b, 0)).toBeCloseTo(4 * 210_000, 2);
  });

  it('alocação que não fecha acende vermelho, bloqueia o salvamento e não lança', () => {
    // B2 fica de fora: 3 de 4 tipologias alocadas.
    const out = calcular(
      faseado([
        { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
      ]),
    );
    const conf = out.conferencias.find((c) => c.chave === 'alocacao_fases')!;
    expect(conf.semaforo).toBe('vermelho');
    expect(conf.valor).toBe('3 de 4 tipologias alocadas');
    expect(conf.detalhe).toContain('B2');
    expect(bloqueiaSalvamento(out.conferencias).map((c) => c.chave)).toContain('alocacao_fases');
    // O motor não falha: usa o que está alocado.
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
    expect(out.meses.reduce((a, m) => a + m.construction, 0)).toBeCloseTo(
      out.agregados.obraTotal - 460_000,
      2,
    );
  });

  it('alocação a mais também não fecha', () => {
    const out = calcular(
      faseado([
        { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 0, faseIndex: 1, quantidade: 1 },
        { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 2, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 3, faseIndex: 0, quantidade: 1 },
      ]),
    );
    expect(semaforo(out, 'alocacao_fases')).toBe('vermelho');
    expect(out.conferencias.find((c) => c.chave === 'alocacao_fases')!.detalhe).toContain('+1');
  });

  it('ignora alocação que aponta para tipologia ou fase inexistente', () => {
    const out = calcular(
      faseado([
        { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
        { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
        { unidadeIndex: 3, faseIndex: 1, quantidade: 1 },
        { unidadeIndex: 99, faseIndex: 0, quantidade: 5 },
        { unidadeIndex: 0, faseIndex: 99, quantidade: 5 },
      ]),
    );
    expect(semaforo(out, 'alocacao_fases')).toBe('verde');
    expect(out.meses.reduce((a, m) => a + m.construction, 0)).toBeCloseTo(out.agregados.obraTotal, 2);
  });

  it('sem fases ligadas a alocação não entra em nada', () => {
    const base = faseado([{ unidadeIndex: 0, faseIndex: 0, quantidade: 1 }]);
    base.usaFases = false;
    const out = calcular(base);
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(calcular(casoBase()).meses));
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });
});

describe('14 — não-regressão e conversões', () => {
  /**
   * Retrato do caso base ANTES das etapas de aportes, fases e alocação.
   *
   * Uma modelagem carregada depois da migration 1761000000 chega ao motor com
   * quantidade = 1, modo_aporte = 'demanda' e usa_fases = false — os defaults que
   * a migration escolheu justamente para isto. Se algum destes números se mexer,
   * uma modelagem já salva mudou de resultado sozinha, e isso é regressão, não
   * melhoria: nenhuma das três etapas tem permissão para tocar neste caminho.
   */
  it('a modelagem herdada produz exatamente os mesmos números de antes', () => {
    const out = calcular(casoBase());
    expect(out.cronograma.prazoTotal).toBe(23);
    expect(out.apuracao.equityTotal).toBeCloseTo(858_384.1133333332, 6);
    expect(out.apuracao.dividaSacada).toBeCloseTo(847_222, 6);
    expect(out.apuracao.custoFinanceiro).toBeCloseTo(66_596.62083333333, 6);
    expect(out.apuracao.lucroProjeto).toBeCloseTo(394_045.0458333334, 6);
    expect(out.apuracao.totalDistribuido).toBeCloseTo(1_173_620.15, 6);
    expect(out.indicadores.moic).toBeCloseTo(1.3672435588800935, 10);
    expect(out.indicadores.tirAnual).toBeCloseTo(0.3099172563385504, 10);
    expect(out.indicadores.xirr).toBeCloseTo(0.31006596584893475, 10);
    expect(out.meses[out.meses.length - 1].caixaAcumulado).toBeCloseTo(78_809.00916666724, 6);
    expect(out.iteracoes).toBe(3);
    // E nada bloqueia o salvamento de uma modelagem que já era válida.
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  /**
   * Congelar a curva do modo demanda como plano.
   *
   * A conversão em si tem de ser exata: a linha de aporte precisa voltar mês a
   * mês idêntica, ao centavo. O que NÃO volta idêntico é o saque no modo
   * equity_first — e isso não é defeito da conversão, é a diferença entre as duas
   * premissas: no modo demanda o saque é dimensionado contra `aporteBaseTotal`,
   * um número declarado que não precisa ter relação nenhuma com o capital
   * realmente chamado; no modo plano ele passa a ser dimensionado contra o
   * capital que efetivamente entrou até cada mês. Os dois testes abaixo separam
   * uma coisa da outra.
   */
  const congelar = (base: ModelInput) => {
    const original = calcular(base);
    const congelado: ModelInput = {
      ...base,
      aportes: {
        modoAporte: 'plano',
        aporteBaseTotal: base.aportes!.aporteBaseTotal,
        valorTotalAlvo: 0,
        parcelas: curvaComoParcelas(original),
      },
    };
    return { original, depois: calcular(congelado) };
  };

  it('congelar a curva devolve a mesma linha de aporte, ao centavo', () => {
    const { original, depois } = congelar(casoBase());
    // A parcela é gravada arredondada ao centavo — é input do usuário, e input não
    // guarda 12 casas. Meio centavo por mês é o limite exato do arredondamento.
    for (const m of original.meses) {
      expect(Math.abs(depois.meses[m.mes - 1].equityCall - m.equityCall)).toBeLessThanOrEqual(0.005);
    }
    expect(Math.abs(depois.apuracao.equityTotal - original.apuracao.equityTotal)).toBeLessThanOrEqual(
      original.meses.length * 0.005,
    );
  });

  it('num modo de saque que não olha o equity, congelar devolve o fluxo inteiro', () => {
    // cash_demand dimensiona a dívida pelo caixa, não pelo equity disponível.
    // Aqui o congelamento é exatamente neutro, e é isso que prova que a conversão
    // curva → parcelas não mexe em nada por conta própria.
    const base = casoBase();
    base.financiamento.modoSaque = 'cash_demand';
    const { original, depois } = congelar(base);
    for (const m of original.meses) {
      const n = depois.meses[m.mes - 1];
      expect(Math.abs(n.equityCall - m.equityCall)).toBeLessThanOrEqual(0.005);
      // O saque do cash_demand lê o caixa de abertura, então herda o mesmo
      // arredondamento acumulado do equity — nada além dele.
      expect(Math.abs(n.draw - m.draw)).toBeLessThanOrEqual(m.mes * 0.005);
      expect(Math.abs(n.caixaAcumulado - m.caixaAcumulado)).toBeLessThanOrEqual(m.mes * 0.005);
    }
    expect(Math.abs(depois.apuracao.dividaSacada - original.apuracao.dividaSacada)).toBeLessThanOrEqual(
      original.meses.length * 0.005,
    );
    expect(Math.abs(depois.apuracao.lucroProjeto - original.apuracao.lucroProjeto)).toBeLessThanOrEqual(
      DOLAR,
    );
  });

  it('no equity_first, congelar muda o saque de propósito', () => {
    // Documenta a diferença em vez de escondê-la: o plano informa QUANDO o capital
    // entra, e o saque passa a ser dimensionado contra isso em vez de contra o
    // aporte base declarado. Se um dia esta asserção passar a falhar, alguém
    // desfez a curva da Etapa 2.3 — não é o congelamento que quebrou.
    const { original, depois } = congelar(casoBase());
    expect(casoBase().financiamento.modoSaque).toBe('equity_first');
    expect(depois.apuracao.dividaSacada).not.toBeCloseTo(original.apuracao.dividaSacada, 2);
    // Ainda assim o projeto continua fechando: a dívida é quitada e o caixa não
    // desaparece — muda a curva de financiamento, não a consistência.
    expect(semaforo(depois, 'saldo_devedor_final')).toBe('verde');
  });

  it('editar o aporte pelo fluxo, em modo plano, mexe na parcela e não cria override', () => {
    const base = casoBase();
    base.aportes = {
      modoAporte: 'plano',
      aporteBaseTotal: 732_778,
      valorTotalAlvo: 0,
      parcelas: [{ mes: 1, valor: 300_000 }],
    };
    expect(editaPlanoDeAportes(base, 'equity_call')).toBe(true);
    // Outras linhas do fluxo continuam sendo override, mesmo com o plano ligado.
    expect(editaPlanoDeAportes(base, 'construction')).toBe(false);

    const editado = comParcelaNoMes(base, 7, 55_000);
    expect(editado.overrides).toEqual([]);
    expect(editado.aportes!.parcelas).toEqual([
      { mes: 1, valor: 300_000 },
      { mes: 7, valor: 55_000 },
    ]);
    // E o fluxo passa a chamar exatamente esse valor no mês 7.
    expect(calcular(editado).meses[6].equityCall).toBeCloseTo(55_000, 6);

    // Reeditar o mesmo mês substitui, não duplica.
    expect(comParcelaNoMes(editado, 7, 10).aportes!.parcelas).toHaveLength(2);
    // E reverter remove a parcela, sem tocar em override nenhum.
    const revertido = semParcelaNoMes(editado, 7);
    expect(revertido.aportes!.parcelas).toEqual([{ mes: 1, valor: 300_000 }]);
    expect(revertido.overrides).toEqual([]);
  });

  it('no modo demanda a edição do fluxo continua sendo override', () => {
    expect(editaPlanoDeAportes(casoBase(), 'equity_call')).toBe(false);
  });
});

describe('15 — a modelagem que já existia, carregada depois da migration', () => {
  /**
   * Linha crua do `loadModelagemCompleta`, no formato EXATO que o driver devolve
   * depois da migration 1761000000: decimais como string, `quantidade` no DEFAULT
   * 1, a linha de `modelagem_aportes` semeada em modo 'demanda' com a soma dos
   * antigos `aporte_base`, `usa_fases` em false e nada de parcela, fase ou
   * alocação.
   *
   * Se este teste passar, uma modelagem gravada antes das etapas 2, 3 e 4
   * atravessa o mapeador e o motor e chega ao MESMO ModelOutput de antes.
   */
  const linhaDoBanco = () => ({
    id: 7,
    nome: 'Caso base',
    localizacao: '',
    tipo_uso: '',
    moeda: 'USD',
    data_inicio: '2025-12-01T00:00:00.000Z',
    meses_aprovacao: 10,
    meses_construcao: 8,
    meses_pos_obra: 5,
    horizonte_maximo: 60,
    usa_fases: false,
    terreno_por_fase: false,
    unidades: [
      { id: 1, ordem: 0, nome: 'A1', cidade: '', quantidade: 1, area_sf: '0', custo_terreno: '25000.00', custo_obra: '210000.00', preco_venda: '320000.00', property_tax_ano: '850.00', aporte_base: '100250.00' },
      { id: 2, ordem: 1, nome: 'A2', cidade: '', quantidade: 1, area_sf: '0', custo_terreno: '25000.00', custo_obra: '210000.00', preco_venda: '320000.00', property_tax_ano: '850.00', aporte_base: '100250.00' },
      { id: 3, ordem: 2, nome: 'B1', cidade: '', quantidade: 1, area_sf: '0', custo_terreno: '95000.00', custo_obra: '460000.00', preco_venda: '825000.00', property_tax_ano: '1800.00', aporte_base: '266139.00' },
      { id: 4, ordem: 3, nome: 'B2', cidade: '', quantidade: 1, area_sf: '0', custo_terreno: '95000.00', custo_obra: '460000.00', preco_venda: '825000.00', property_tax_ano: '1800.00', aporte_base: '266139.00' },
    ],
    custos: [{ id: 1, ordem: 0, label: 'Contingência', valor: '56000.00', distribuicao: 'linear_construction', mes_ancora: null }],
    // Semeada pela migration: SUM(aporte_base) = 732.778.
    aportes: { id: 1, modelagem_id: 7, modo_aporte: 'demanda', aporte_base_total: '732778.00', valor_total_alvo: '0.00' },
    aporte_parcelas: null,
    fases: null,
    unidade_fases: null,
    financiamento: {
      taxa_anual: '0.0950', fee_estruturacao_pct: '0.0150', fee_timing: 'first_draw', fee_mes: null,
      mes_inicio_saque: 13, mes_fim_saque: 23, modo_saque: 'equity_first', max_ltc_pct: null,
      valor_contratado: null, custo_financeiro_na_demanda: false, modo_amortizacao: 'at_exit',
      capitalizar_juros: false, colchao_minimo_caixa: '0.00',
    },
    socios: [
      { id: 1, ordem: 0, nome: 'Sócio 1', participacao_pct: '0.5000', cota_disponivel: false },
      { id: 2, ordem: 1, nome: 'Sócio 2', participacao_pct: '0.5000', cota_disponivel: false },
    ],
    receita: {
      comissao_pct: '0.0600', custo_cartorio_pct: '0.0200', modo_venda: 'single_exit', mes_saida: 23,
      lucro_investidores_pct: '0.8000', lucro_sponsor_pct: '0.2000',
    },
    vendas_unidade: null,
    overrides: null,
  });

  const input = mapearModelInput(linhaDoBanco());

  it('mapeia para os defaults neutros das três etapas', () => {
    expect(input.unidades.every((u) => u.quantidade === 1)).toBe(true);
    expect(input.aportes?.modoAporte).toBe('demanda');
    expect(input.aportes?.aporteBaseTotal).toBe(732_778);
    expect(input.aportes?.parcelas).toEqual([]);
    expect(input.usaFases).toBe(false);
    expect(input.terrenoPorFase).toBe(false);
    expect(input.fases).toEqual([]);
    expect(input.alocacoes).toEqual([]);
  });

  it('produz o mesmo ModelOutput do caso base, campo a campo', () => {
    const doBanco = calcular(input);
    const referencia = calcular(casoBase());
    expect(JSON.stringify(doBanco.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(doBanco.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(doBanco.indicadores)).toBe(JSON.stringify(referencia.indicadores));
    expect(JSON.stringify(doBanco.agregados)).toBe(JSON.stringify(referencia.agregados));
    expect(JSON.stringify(doBanco.resultadoUnidades)).toBe(JSON.stringify(referencia.resultadoUnidades));
  });

  it('não ganha conferência nova nem bloqueio de salvamento', () => {
    const doBanco = calcular(input);
    // Nenhuma conferência de aporte, fase ou alocação aparece: todas são
    // condicionais ao modo plano e ao switch de fases.
    for (const chave of [
      'aporte_plano_vs_alvo', 'aporte_parcela_fora_prazo', 'aporte_override_no_plano',
      'alocacao_fases', 'fases_sem_linha', 'fase_invertida', 'fases_dentro_prazo',
      'fases_sobrepostas', 'fases_com_buraco',
    ]) {
      expect(semaforo(doBanco, chave)).toBeUndefined();
    }
    expect(doBanco.conferencias.map((c) => c.chave)).toEqual(
      calcular(casoBase()).conferencias.map((c) => c.chave),
    );
    expect(bloqueiaSalvamento(doBanco.conferencias)).toHaveLength(0);
  });
});

describe('11 — orçamento por categoria', () => {
  // Teste de NÃO-REGRESSÃO da migration 1761200000.
  //
  // Categoria é agrupamento de SAÍDA, não regra de lançamento. A prova é dupla:
  //   (a) uma modelagem toda em 'outros' — o default da coluna, e portanto o
  //       estado de toda linha já gravada — produz o ModelOutput de antes;
  //   (b) redistribuir as MESMAS linhas por categorias diferentes não move um
  //       único mês do fluxo. Se algum dia a categoria vazar para o loop mensal,
  //       é (b) que quebra.
  const semCategoria = (): ModelInput => {
    const base = casoBase();
    // Exatamente o que o mapeador entrega para uma linha gravada antes da
    // migration: `categoria` ausente no banco vira 'outros'.
    base.custosAdicionais = [
      { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
    ];
    return base;
  };

  const referencia = calcular(semCategoria());

  it('mantém o fluxo, a apuração e os indicadores do caso base', () => {
    const out = calcular(casoBase());
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(out.indicadores)).toBe(JSON.stringify(referencia.indicadores));
    expect(JSON.stringify(out.resultadoUnidades)).toBe(JSON.stringify(referencia.resultadoUnidades));
  });

  it('só acrescenta custosPorCategoria aos agregados', () => {
    const { custosPorCategoria, ...resto } = referencia.agregados;
    // O que já existia continua idêntico ao caso base de antes da categorização.
    expect(resto).toEqual({
      terrenosTotal: 240_000,
      obraTotal: 1_340_000,
      unidadesTotal: 4,
      vgv: 2_290_000,
      taxAnoTotal: 5_300,
      propertyTaxTotal: (5_300 / 12) * 23,
      equityDisponivelObra: 492_778,
      aportePlanejadoTotal: 0,
    });
    // Toda linha antiga cai em 'outros'; nenhum outro bucket ganha valor.
    expect(custosPorCategoria.outros).toBeCloseTo(56_000, 6);
    expect(Object.values(custosPorCategoria).reduce((a, b) => a + b, 0)).toBeCloseTo(56_000, 6);
  });

  it('devolve TODAS as categorias, inclusive as zeradas', () => {
    expect(Object.keys(referencia.agregados.custosPorCategoria)).toEqual(CATEGORIAS_CUSTO);
  });

  it('não acrescenta conferência nem bloqueio de salvamento', () => {
    expect(referencia.conferencias.map((c) => c.chave)).toEqual(
      calcular(casoBase()).conferencias.map((c) => c.chave),
    );
    expect(bloqueiaSalvamento(referencia.conferencias)).toHaveLength(0);
  });

  it('subtotaliza por categoria sem mover o fluxo', () => {
    const base = casoBase();
    // O MESMO orçamento de 56.000, agora quebrado em cinco linhas espalhadas por
    // quatro categorias. A distribuição no tempo de cada linha é a mesma da
    // linha única original, então o fluxo tem de sair idêntico.
    base.custosAdicionais = [
      { label: 'Sitework', valor: 20_000, distribuicao: 'linear_construction', categoria: 'sitework', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
      { label: 'Mobilização', valor: 6_000, distribuicao: 'linear_construction', categoria: 'sitework', grupoPaiId: 1, baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
      { label: 'Amenidades', valor: 10_000, distribuicao: 'linear_construction', categoria: 'amenidades', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
      { label: 'Projeto', valor: 12_000, distribuicao: 'linear_construction', categoria: 'soft', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
      { label: 'Contingência', valor: 8_000, distribuicao: 'linear_construction', categoria: 'contingencia', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const out = calcular(base);

    // (b): nenhum mês se move.
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));

    const cat = out.agregados.custosPorCategoria;
    // Pai e filho somam UMA vez cada dentro da categoria: grupoPaiId é hierarquia
    // visual, e somar o pai de novo daria 26.000 + 6.000.
    expect(cat.sitework).toBeCloseTo(26_000, 6);
    expect(cat.amenidades).toBeCloseTo(10_000, 6);
    expect(cat.soft).toBeCloseTo(12_000, 6);
    expect(cat.contingencia).toBeCloseTo(8_000, 6);
    expect(cat.outros).toBe(0);
    expect(Object.values(cat).reduce((a, b) => a + b, 0)).toBeCloseTo(56_000, 6);
  });

  it('joga categoria desconhecida em outros, sem lançar exceção', () => {
    const base = casoBase();
    base.custosAdicionais = [
      // Input inconsistente vira resultado, nunca erro — e nunca chave nova.
      { label: 'Ruído', valor: 9_000, distribuicao: 'linear_total', categoria: 'inexistente' as never, baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const out = calcular(base);
    expect(Object.keys(out.agregados.custosPorCategoria)).toEqual(CATEGORIAS_CUSTO);
    expect(out.agregados.custosPorCategoria.outros).toBeCloseTo(9_000, 6);
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
  });

  it('mapeia categoria e grupo_pai do banco, com o default para linha antiga', () => {
    const custos = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      custos: [
        // Linha gravada ANTES da migration: sem as colunas novas.
        { id: 1, ordem: 0, label: 'Antiga', valor: '56000.00', distribuicao: 'linear_construction', mes_ancora: null },
        // Linha nova, com categoria e pai. `grupo_pai` chega como INTEGER e
        // `valor` como STRING — as duas passam pela coerção de mapear.ts.
        { id: 2, ordem: 1, label: 'Filha', valor: '6000.00', distribuicao: 'linear_construction', mes_ancora: null, categoria: 'sitework', grupo_pai: 1 },
        // Categoria fora do CHECK não deveria existir no banco, mas o mapeador
        // não pode confiar nisso.
        { id: 3, ordem: 2, label: 'Torta', valor: '1000.00', distribuicao: 'manual', mes_ancora: null, categoria: 'zzz', grupo_pai: null },
      ],
    } as never).custosAdicionais!;

    expect(custos[0].categoria).toBe('outros');
    expect(custos[0].grupoPaiId).toBeNull();
    expect(custos[1].categoria).toBe('sitework');
    expect(custos[1].grupoPaiId).toBe(1);
    expect(custos[2].categoria).toBe('outros');
    // A coerção de mapear.ts continua obrigatória: DECIMAL vem como string e
    // sem num() a soma viraria concatenação.
    expect(custos.reduce((a, c) => a + c.valor, 0)).toBe(63_000);
  });
});

describe('12 — base de cálculo do custo', () => {
  // Teste de NÃO-REGRESSÃO da migration 1761300000.
  //
  // A base muda QUANTO é lançado, nunca QUANDO. Com base 'total' — o default da
  // coluna, e o estado de toda linha já gravada — o motor lê `valor` exatamente
  // como lia antes, e o ModelOutput é byte a byte o mesmo.
  const referencia = calcular(casoBase());

  const comArea = (): ModelInput => {
    const base = casoBase();
    // 1.800 sf por unidade × 4 unidades = 7.200 sf de área total.
    base.unidades = base.unidades.map((u) => ({ ...u, areaSf: 1_800 }));
    return base;
  };

  it("base 'total' produz exatamente o valor de antes", () => {
    const base = casoBase();
    base.custosAdicionais = [
      { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 999, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const out = calcular(base);
    // valorUnitario preenchido é INERTE quando a base é 'total': se vazasse para
    // a conta, o fluxo mudaria.
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(out.agregados)).toBe(JSON.stringify(referencia.agregados));
  });

  it('base ausente cai em total, como a linha nunca migrada', () => {
    const base = casoBase();
    base.custosAdicionais = [
      // Exatamente o objeto que existia antes desta migration.
      { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros' } as never,
    ];
    expect(JSON.stringify(calcular(base).meses)).toBe(JSON.stringify(referencia.meses));
  });

  it('por_unidade multiplica pela Σ quantidade das tipologias', () => {
    const base = casoBase();
    // 45 casas numa única tipologia, a $5.200,93 por unidade.
    base.unidades = [
      { nome: 'Casa', quantidade: 45, custoTerreno: 25_000, custoObra: 210_000, precoVenda: 320_000, propertyTaxAno: 850 },
    ];
    base.custosAdicionais = [
      { label: 'Taxas', valor: 0, distribuicao: 'linear_construction', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 5_200.93, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const out = calcular(base);
    expect(out.agregados.unidadesTotal).toBe(45);
    // 45 × 5.200,93 = 234.041,85.
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(234_041.85, 2);
    // E é esse mesmo número que entra no fluxo, não outro.
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(234_041.85, 2);
  });

  it('por_sf multiplica pela área TOTAL: areaSf × quantidade', () => {
    const base = comArea();
    base.custosAdicionais = [
      { label: 'Construção vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const out = calcular(base);
    // 214 × 7.200 sf = 1.540.800. A área é POR UNIDADE e o motor multiplica pela
    // quantidade — a mesma regra de custoTerreno, custoObra e precoVenda.
    expect(out.agregados.custosPorCategoria.vertical).toBeCloseTo(1_540_800, 2);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(1_540_800, 2);
  });

  it('descreve o mesmo projeto por unidade ou por sf com o mesmo resultado', () => {
    // $385.200 por unidade são $214/sf sobre 1.800 sf. As duas descrições têm de
    // produzir fluxos idênticos.
    const porUnidade = comArea();
    porUnidade.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_unidade', valorUnitario: 385_200, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const porSf = comArea();
    porSf.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const },
    ];
    expect(JSON.stringify(calcular(porSf).meses)).toBe(JSON.stringify(calcular(porUnidade).meses));
  });

  it('acompanha a mudança de quantidade sem redigitar o custo', () => {
    // É o ponto do item: de 45 para 60 unidades, o orçamento se reajusta sozinho.
    const de45 = casoBase();
    de45.unidades = [{ nome: 'Casa', quantidade: 45, custoTerreno: 0, custoObra: 0, precoVenda: 320_000, propertyTaxAno: 0 }];
    de45.custosAdicionais = [
      { label: 'Taxas', valor: 0, distribuicao: 'linear_total', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const de60 = { ...de45, unidades: [{ ...de45.unidades[0], quantidade: 60 }] };
    expect(calcular(de45).agregados.custosPorCategoria.soft).toBeCloseTo(45_000, 2);
    expect(calcular(de60).agregados.custosPorCategoria.soft).toBeCloseTo(60_000, 2);
  });

  it('a base não muda a distribuição no tempo', () => {
    // Mesmo total (56.000), uma vez como total e outra como unitário, na mesma
    // distribuição: mês a mês tem de dar igual.
    const base = casoBase();
    base.unidades = base.unidades.map((u) => ({ ...u, areaSf: 1_800 }));
    const comoTotal = { ...base, custosAdicionais: [
      { label: 'X', valor: 56_000, distribuicao: 'single_month' as const, mesAncora: 12, categoria: 'soft' as const, baseCalculo: 'total' as const, valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const },
    ] };
    const comoUnitario = { ...base, custosAdicionais: [
      { label: 'X', valor: 0, distribuicao: 'single_month' as const, mesAncora: 12, categoria: 'soft' as const, baseCalculo: 'por_unidade' as const, valorUnitario: 14_000, percentual: 0, gatilho: 'cronograma' as const },
    ] };
    expect(JSON.stringify(calcular(comoUnitario).meses)).toBe(JSON.stringify(calcular(comoTotal).meses));
  });

  it('denominador zero zera o custo e acende custo_base_zerada em âmbar', () => {
    const base = casoBase();
    // Tipologias sem área: por_sf fica sem denominador.
    base.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const },
    ];
    const out = calcular(base);
    expect(out.agregados.custosPorCategoria.vertical).toBe(0);
    expect(semaforo(out, 'custo_base_zerada')).toBe('ambar');
    // Nunca lança, e nunca bloqueia salvamento.
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  it('não acende custo_base_zerada quando o denominador existe', () => {
    const base = comArea();
    base.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const },
    ];
    expect(semaforo(calcular(base), 'custo_base_zerada')).toBeUndefined();
    // E o caso base, todo em 'total', tampouco ganha conferência nova.
    expect(referencia.conferencias.map((c) => c.chave)).not.toContain('custo_base_zerada');
  });

  it('override em other_costs continua vencendo a base de cálculo', () => {
    // A invariante do módulo: qualquer regra nova é só a FONTE AUTOMÁTICA da
    // linha; o override daquela célula ganha sempre.
    const base = comArea();
    base.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const },
    ];
    base.overrides = [{ mes: 12, linha: 'other_costs', valor: 1_234 }];
    const out = calcular(base);
    expect(out.meses[11].otherCosts).toBe(1_234);
    // O subtotal do orçamento segue mostrando o que a BASE calcula: ele é o
    // orçamento declarado, não o que sobrou depois dos overrides.
    expect(out.agregados.custosPorCategoria.vertical).toBeCloseTo(1_540_800, 2);
  });

  it('mapeia base_calculo e valor_unitario do banco, com o default para linha antiga', () => {
    const custos = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      custos: [
        // Linha gravada ANTES da migration: sem as colunas novas.
        { id: 1, ordem: 0, label: 'Antiga', valor: '56000.00', distribuicao: 'linear_construction', mes_ancora: null },
        // DECIMAL(15,4) chega como STRING — sem num() viraria NaN e o custo
        // sumiria do orçamento sem erro nenhum.
        { id: 2, ordem: 1, label: 'Vertical', valor: '0.00', distribuicao: 'linear_construction', mes_ancora: null, categoria: 'vertical', base_calculo: 'por_sf', valor_unitario: '214.3750' },
        // Base fora do CHECK não deveria existir no banco; o mapeador não confia.
        { id: 3, ordem: 2, label: 'Torta', valor: '900.00', distribuicao: 'manual', mes_ancora: null, base_calculo: 'por_lf', valor_unitario: '10.00' },
      ],
    } as never).custosAdicionais!;

    expect(custos[0].baseCalculo).toBe('total');
    expect(custos[0].valorUnitario).toBe(0);
    expect(custos[1].baseCalculo).toBe('por_sf');
    expect(custos[1].valorUnitario).toBe(214.375);
    // Base desconhecida cai em 'total', então vale `valor` — e não some dinheiro.
    expect(custos[2].baseCalculo).toBe('total');
    expect(valorEfetivoCusto(custos[2], { unidades: 0, areaSf: 0 })).toBe(900);
  });

  it('basesDeCalculo é pura e trata quantidade inválida como 1', () => {
    const unidades = [
      { nome: 'A', quantidade: 2, custoTerreno: 0, custoObra: 0, precoVenda: 0, propertyTaxAno: 0, areaSf: 1_000 },
      { nome: 'B', quantidade: 0, custoTerreno: 0, custoObra: 0, precoVenda: 0, propertyTaxAno: 0, areaSf: 500 },
    ];
    expect(basesDeCalculo(unidades)).toEqual({ unidades: 3, areaSf: 2_500 });
    // Chamar duas vezes devolve o mesmo: nada de estado escondido.
    expect(basesDeCalculo(unidades)).toEqual(basesDeCalculo(unidades));
    expect(basesDeCalculo([])).toEqual({ unidades: 0, areaSf: 0 });
  });
});

/** Custo com os defaults do banco; cada teste declara só o que importa. */
const custo = (p: Partial<CustoAdicional> & { label: string }): CustoAdicional => ({
  valor: 0,
  distribuicao: 'linear_construction',
  mesAncora: null,
  categoria: 'outros',
  grupoPaiId: null,
  baseCalculo: 'total',
  valorUnitario: 0,
  grupoReferencia: null,
  percentual: 0,
  gatilho: 'cronograma',
  ...p,
});

describe('13 — despesa como percentual de um grupo', () => {
  // Teste de NÃO-REGRESSÃO da migration 1761400000.
  //
  // 'pct_de_grupo' é inalcançável para toda linha já gravada (o default é
  // 'total'), então o caminho novo não pode tocar em nada do que existe.
  const referencia = calcular(casoBase());

  it("base 'total' com percentual preenchido não muda nada", () => {
    const base = casoBase();
    base.custosAdicionais = [
      // percentual e grupoReferencia INERTES fora de 'pct_de_grupo': se vazassem
      // para a conta, o fluxo mudaria.
      custo({ label: 'Contingência', valor: 56_000, categoria: 'outros', percentual: 0.5, grupoReferencia: 'vertical' }),
    ];
    const out = calcular(base);
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(out.agregados)).toBe(JSON.stringify(referencia.agregados));
    expect(out.conferencias.map((c) => c.chave)).toEqual(
      referencia.conferencias.map((c) => c.chave),
    );
  });

  it('incide sobre a categoria de referência mais o custo direto das tipologias', () => {
    const base = casoBase();
    // Uma categoria 'vertical' de $21.834.000: $20.000.000 de obra nas
    // tipologias + $1.834.000 lançados como custo adicional vertical.
    base.unidades = [
      { nome: 'Casa', quantidade: 40, custoTerreno: 25_000, custoObra: 500_000, precoVenda: 900_000, propertyTaxAno: 0 },
    ];
    base.custosAdicionais = [
      custo({ label: 'Vertical extra', valor: 1_834_000, categoria: 'vertical' }),
      custo({ label: 'Contingência', categoria: 'contingencia', baseCalculo: 'pct_de_grupo', grupoReferencia: 'vertical', percentual: 0.05 }),
    ];
    const out = calcular(base);
    // obraTotal = 40 × 500.000 = 20.000.000; + 1.834.000 = 21.834.000.
    expect(out.agregados.obraTotal).toBeCloseTo(20_000_000, 2);
    // 5% de 21.834.000 = 1.091.700.
    expect(out.agregados.custosPorCategoria.contingencia).toBeCloseTo(1_091_700, 2);
    // E é esse número que entra no fluxo.
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(1_834_000 + 1_091_700, 2);
  });

  it('sobe sozinha quando a obra sobe, no mesmo recálculo', () => {
    // O ponto do item: ninguém precisa lembrar de refazer a conta.
    const montar = (custoObra: number): ModelInput => {
      const base = casoBase();
      base.unidades = [
        { nome: 'Casa', quantidade: 40, custoTerreno: 25_000, custoObra, precoVenda: 900_000, propertyTaxAno: 0 },
      ];
      base.custosAdicionais = [
        custo({ label: 'Vertical extra', valor: 1_834_000, categoria: 'vertical' }),
        custo({ label: 'Contingência', categoria: 'contingencia', baseCalculo: 'pct_de_grupo', grupoReferencia: 'vertical', percentual: 0.05 }),
      ];
      return base;
    };
    expect(calcular(montar(500_000)).agregados.custosPorCategoria.contingencia).toBeCloseTo(1_091_700, 2);
    // +10% de obra → 22.000.000 + 1.834.000 = 23.834.000 × 5% = 1.191.700.
    expect(calcular(montar(550_000)).agregados.custosPorCategoria.contingencia).toBeCloseTo(1_191_700, 2);
  });

  it("'terreno' soma o custo de terreno das tipologias; as demais categorias não somam nada da unidade", () => {
    const base = casoBase();
    base.unidades = [
      { nome: 'Casa', quantidade: 10, custoTerreno: 100_000, custoObra: 300_000, precoVenda: 900_000, propertyTaxAno: 0 },
    ];
    base.custosAdicionais = [
      custo({ label: 'Sobre terreno', categoria: 'soft', baseCalculo: 'pct_de_grupo', grupoReferencia: 'terreno', percentual: 0.1 }),
      // 'sitework' não tem contrapartida em modelagem_unidades: a base é só o que
      // estiver lançado como custo adicional daquela categoria, e não há nada.
      custo({ label: 'Sobre sitework', categoria: 'offsite', baseCalculo: 'pct_de_grupo', grupoReferencia: 'sitework', percentual: 0.1 }),
    ];
    const out = calcular(base);
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(100_000, 2); // 10% de 1.000.000
    expect(out.agregados.custosPorCategoria.offsite).toBe(0);
    // O que ficou zerado por falta de base acende âmbar, não some calado.
    expect(semaforo(out, 'custo_base_zerada')).toBe('ambar');
  });

  it('encadeia percentual sobre percentual sem duplicar', () => {
    const base = casoBase();
    base.unidades = [
      { nome: 'Casa', quantidade: 1, custoTerreno: 0, custoObra: 1_000_000, precoVenda: 2_000_000, propertyTaxAno: 0 },
    ];
    base.custosAdicionais = [
      // 10% da obra = 100.000, na categoria soft.
      custo({ label: 'Projeto', categoria: 'soft', baseCalculo: 'pct_de_grupo', grupoReferencia: 'vertical', percentual: 0.1 }),
      // 20% de soft = 20.000. Depende do item acima — a ordem de resolução é
      // topológica, não a ordem do array.
      custo({ label: 'Gerenciamento', categoria: 'amenidades', baseCalculo: 'pct_de_grupo', grupoReferencia: 'soft', percentual: 0.2 }),
    ];
    const out = calcular(base);
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(100_000, 2);
    expect(out.agregados.custosPorCategoria.amenidades).toBeCloseTo(20_000, 2);
    expect(semaforo(out, 'custo_referencia_circular')).toBeUndefined();
  });

  it('resolve na ordem topológica, não na ordem do array', () => {
    const montar = (invertido: boolean): ModelInput => {
      const base = casoBase();
      base.unidades = [
        { nome: 'Casa', quantidade: 1, custoTerreno: 0, custoObra: 1_000_000, precoVenda: 2_000_000, propertyTaxAno: 0 },
      ];
      const a = custo({ label: 'Projeto', categoria: 'soft', baseCalculo: 'pct_de_grupo', grupoReferencia: 'vertical', percentual: 0.1 });
      const b = custo({ label: 'Gerenciamento', categoria: 'amenidades', baseCalculo: 'pct_de_grupo', grupoReferencia: 'soft', percentual: 0.2 });
      base.custosAdicionais = invertido ? [b, a] : [a, b];
      return base;
    };
    const normal = calcular(montar(false));
    const invertido = calcular(montar(true));
    expect(invertido.agregados.custosPorCategoria.amenidades).toBeCloseTo(20_000, 2);
    expect(JSON.stringify(invertido.agregados.custosPorCategoria)).toBe(
      JSON.stringify(normal.agregados.custosPorCategoria),
    );
  });

  it('zera a auto-referência e acende custo_referencia_circular em vermelho', () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Contingência', valor: 10_000, categoria: 'contingencia' }),
      // Incide sobre a PRÓPRIA categoria: cada passada aumentaria a anterior.
      custo({ label: 'Circular', categoria: 'contingencia', baseCalculo: 'pct_de_grupo', grupoReferencia: 'contingencia', percentual: 0.05 }),
    ];
    const out = calcular(base);
    expect(semaforo(out, 'custo_referencia_circular')).toBe('vermelho');
    // O item em ciclo vale 0; o custo fixo da mesma categoria continua valendo.
    expect(out.agregados.custosPorCategoria.contingencia).toBeCloseTo(10_000, 2);
    // Nunca lança e nunca bloqueia o salvamento.
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  it('zera OS DOIS itens de um ciclo mútuo, qualquer que seja a ordem', () => {
    const montar = (invertido: boolean): ModelInput => {
      const base = casoBase();
      const a = custo({ label: 'A', categoria: 'soft', baseCalculo: 'pct_de_grupo', grupoReferencia: 'amenidades', percentual: 0.1 });
      const b = custo({ label: 'B', categoria: 'amenidades', baseCalculo: 'pct_de_grupo', grupoReferencia: 'soft', percentual: 0.2 });
      base.custosAdicionais = invertido ? [b, a] : [a, b];
      return base;
    };
    for (const invertido of [false, true]) {
      const out = calcular(montar(invertido));
      // Determinismo: os DOIS zeram, não "o que a travessia encontrar primeiro".
      expect(out.agregados.custosPorCategoria.soft).toBe(0);
      expect(out.agregados.custosPorCategoria.amenidades).toBe(0);
      const conf = out.conferencias.find((c) => c.chave === 'custo_referencia_circular');
      expect(conf?.semaforo).toBe('vermelho');
      expect(conf?.valor).toBe('2');
      expect(conf?.detalhe).toContain('A →');
      expect(conf?.detalhe).toContain('B →');
    }
  });

  it('detecta ciclo indireto de três categorias', () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'A', categoria: 'soft', baseCalculo: 'pct_de_grupo', grupoReferencia: 'amenidades', percentual: 0.1 }),
      custo({ label: 'B', categoria: 'amenidades', baseCalculo: 'pct_de_grupo', grupoReferencia: 'offsite', percentual: 0.1 }),
      custo({ label: 'C', categoria: 'offsite', baseCalculo: 'pct_de_grupo', grupoReferencia: 'soft', percentual: 0.1 }),
      // Fora do ciclo: depende de 'soft' (que zerou), mas nada volta para 'sitework'.
      custo({ label: 'D', categoria: 'sitework', baseCalculo: 'pct_de_grupo', grupoReferencia: 'soft', percentual: 0.1 }),
    ];
    const out = calcular(base);
    expect(out.conferencias.find((c) => c.chave === 'custo_referencia_circular')?.valor).toBe('3');
    expect(out.agregados.custosPorCategoria.sitework).toBe(0); // 10% de 0
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
  });

  it('mapeia grupo_referencia e percentual do banco, com o default para linha antiga', () => {
    const custos = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      custos: [
        // Linha gravada ANTES da migration: sem as colunas novas.
        { id: 1, ordem: 0, label: 'Antiga', valor: '56000.00', distribuicao: 'linear_construction', mes_ancora: null },
        // DECIMAL(9,6) chega como STRING: sem num(), "0.050000" × base seria
        // coerção implícita silenciosa.
        { id: 2, ordem: 1, label: 'Contingência', valor: '0.00', distribuicao: 'linear_construction', mes_ancora: null, categoria: 'contingencia', base_calculo: 'pct_de_grupo', grupo_referencia: 'vertical', percentual: '0.050000' },
        // Grupo fora da lista não deveria existir no banco; o mapeador não confia.
        { id: 3, ordem: 2, label: 'Torta', valor: '0.00', distribuicao: 'manual', mes_ancora: null, base_calculo: 'pct_de_grupo', grupo_referencia: 'zzz', percentual: '0.10' },
      ],
    } as never).custosAdicionais!;

    expect(custos[0].baseCalculo).toBe('total');
    expect(custos[0].grupoReferencia).toBeNull();
    expect(custos[0].percentual).toBe(0);
    expect(custos[1].grupoReferencia).toBe('vertical');
    expect(custos[1].percentual).toBe(0.05);
    expect(custos[2].grupoReferencia).toBeNull();
  });

  it('resolverCustos é puro: mesma entrada, mesma saída', () => {
    const lista = [
      custo({ label: 'Obra extra', valor: 1_000_000, categoria: 'vertical' }),
      custo({ label: 'Contingência', categoria: 'contingencia', baseCalculo: 'pct_de_grupo', grupoReferencia: 'vertical', percentual: 0.05 }),
    ];
    const bases = { unidades: 0, areaSf: 0 };
    const diretos = { terreno: 0, vertical: 0 };
    const a = resolverCustos(lista, bases, diretos);
    const b = resolverCustos(lista, bases, diretos);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.valores[1]).toBeCloseTo(50_000, 6);
    expect(a.referencias.vertical).toBeCloseTo(1_000_000, 6);
    // A entrada não é mutada.
    expect(lista[1].valor).toBe(0);
  });
});

describe('14 — gatilho de vencimento do custo', () => {
  // Teste de NÃO-REGRESSÃO da migration 1761500000.
  //
  // 'cronograma' é o default e reproduz a distribuição de sempre. Este bloco é o
  // que garante que a inversão do laço de lançamento (antes por mês, agora por
  // custo) não moveu um centavo.
  const referencia = calcular(casoBase());

  it("gatilho 'cronograma' produz o fluxo idêntico ao de antes", () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Contingência', valor: 56_000, categoria: 'outros', gatilho: 'cronograma' }),
    ];
    const out = calcular(base);
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(out.conferencias.map((c) => c.chave)).toEqual(
      referencia.conferencias.map((c) => c.chave),
    );
  });

  it('gatilho ausente cai em cronograma, como a linha nunca migrada', () => {
    const base = casoBase();
    base.custosAdicionais = [
      // Exatamente o objeto que existia antes desta migration.
      { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 0 } as never,
    ];
    expect(JSON.stringify(calcular(base).meses)).toBe(JSON.stringify(referencia.meses));
  });

  it('lança 100% no início e no fim da obra', () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra' }),
      custo({ label: 'Habite-se', valor: 30_000, categoria: 'soft', gatilho: 'fim_obra' }),
    ];
    const out = calcular(base);
    // Caso base: 10 meses de aprovação, 8 de obra → obra do mês 11 ao 18.
    expect(out.cronograma.mesInicioObra).toBe(11);
    expect(out.cronograma.mesFimObra).toBe(18);
    expect(out.meses[10].otherCosts).toBeCloseTo(90_000, 2);
    expect(out.meses[17].otherCosts).toBeCloseTo(30_000, 2);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(120_000, 2);
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBeUndefined();
  });

  it('o gatilho substitui a distribuição, não convive com ela', () => {
    const base = casoBase();
    base.custosAdicionais = [
      // distribuicao linear_construction seria diluída em 8 meses; o gatilho
      // mes_fixo manda tudo para o mês 3.
      custo({ label: 'Impact fee', valor: 60_000, categoria: 'soft', distribuicao: 'linear_construction', mesAncora: 3, gatilho: 'mes_fixo' }),
    ];
    const out = calcular(base);
    expect(out.meses[2].otherCosts).toBeCloseTo(60_000, 2);
    expect(out.meses[10].otherCosts).toBe(0);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(60_000, 2);
  });

  it('por_venda distribui pelas vendas e soma o total, sem perder centavo', () => {
    // A verificação do item: $5.200,93 por unidade, 45 unidades em 12 levas de
    // 3 e 4, somando $234.041,85. Sem takedown, cada leva é uma tipologia.
    const base = casoBase();
    const levas = [4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3]; // 12 meses, 45 unidades
    base.unidades = levas.map((n, k) => ({
      nome: `Leva ${k + 1}`,
      quantidade: n,
      custoTerreno: 0,
      custoObra: 0,
      precoVenda: 300_000,
      propertyTaxAno: 0,
    }));
    base.receita.modoVenda = 'per_unit';
    base.receita.vendasPorUnidade = levas.map((_n, k) => ({ unidadeIndex: k, mesVenda: 12 + k }));
    base.custosAdicionais = [
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 5_200.93, gatilho: 'por_venda' }),
    ];
    const out = calcular(base);

    expect(out.agregados.unidadesTotal).toBe(45);
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(234_041.85, 2);

    // Aparece nos 12 meses das vendas, e em nenhum outro.
    const comCusto = out.meses.filter((m) => m.otherCosts > 0).map((m) => m.mes);
    expect(comCusto).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
    // Cada mês recebe valorUnitario × unidades daquela leva.
    expect(out.meses[11].otherCosts).toBeCloseTo(5_200.93 * 4, 2);
    expect(out.meses[20].otherCosts).toBeCloseTo(5_200.93 * 3, 2);
    // E o total fecha exatamente com o orçamento: nada some no rateio.
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(234_041.85, 2);
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBeUndefined();
  });

  it('por_venda com saída única lança tudo no mês da saída', () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, gatilho: 'por_venda' }),
    ];
    // Caso base é single_exit com mesSaida 23: todas as unidades fecham ali.
    const out = calcular(base);
    expect(out.meses[22].otherCosts).toBeCloseTo(4_000, 2);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(4_000, 2);
  });

  it('acusa em âmbar o que o gatilho não conseguiu lançar', () => {
    const base = casoBase();
    base.receita.modoVenda = 'manual'; // nenhuma venda declarada
    base.custosAdicionais = [
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, gatilho: 'por_venda' }),
      // mes_fixo sem âncora: não há onde lançar.
      custo({ label: 'Taxa', valor: 5_000, categoria: 'soft', gatilho: 'mes_fixo' }),
      // Âncora além do prazo de 23 meses.
      custo({ label: 'Tardia', valor: 7_000, categoria: 'soft', mesAncora: 99, gatilho: 'mes_fixo' }),
    ];
    const out = calcular(base);
    const conf = out.conferencias.find((c) => c.chave === 'custo_gatilho_nao_lancado');
    expect(conf?.semaforo).toBe('ambar');
    expect(conf?.detalhe).toContain('Impact fee');
    expect(conf?.detalhe).toContain('Taxa');
    expect(conf?.detalhe).toContain('Tardia');
    // Nada foi lançado, e nada foi apagado: o orçamento segue mostrando o total.
    expect(soma(out.meses.map((m) => m.otherCosts))).toBe(0);
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(4_000 + 5_000 + 7_000, 2);
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  it('override em other_costs continua vencendo o gatilho', () => {
    // A invariante do módulo: a regra nova é só a FONTE AUTOMÁTICA da linha.
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra' }),
    ];
    base.overrides = [{ mes: 11, linha: 'other_costs', valor: 1_234 }];
    const out = calcular(base);
    expect(out.meses[10].otherCosts).toBe(1_234);
    // O orçamento declarado não muda por causa do override.
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(90_000, 2);
  });

  it('mapeia gatilho do banco, com o default para linha antiga', () => {
    const custos = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      custos: [
        { id: 1, ordem: 0, label: 'Antiga', valor: '56000.00', distribuicao: 'linear_construction', mes_ancora: null },
        { id: 2, ordem: 1, label: 'Fee', valor: '0.00', distribuicao: 'manual', mes_ancora: null, gatilho: 'por_venda' },
        { id: 3, ordem: 2, label: 'Torta', valor: '0.00', distribuicao: 'manual', mes_ancora: null, gatilho: 'zzz' },
      ],
    } as never).custosAdicionais!;
    expect(custos[0].gatilho).toBe('cronograma');
    expect(custos[1].gatilho).toBe('por_venda');
    expect(custos[2].gatilho).toBe('cronograma');
  });
});
