/**
 * Critérios de aceite do motor de modelagem.
 *
 * O caso base reproduz um projeto real. Tolerância de US$ 1,00 nos valores e de
 * 0,0001 nos indicadores adimensionais.
 */
import { describe, expect, it } from 'vitest';
import {
  agruparCustosPorCategoria,
  basesDeCalculo,
  calcular,
  fatorJurosDoMes,
  resolverCustos,
  valorEfetivoCusto,
} from './motor';
import { bloqueiaSalvamento } from './conferencias';
import { indiceMes, tirMensal, somarMeses } from './indicadores';
import {
  aporteSomenteLeitura,
  comParcelaNoMes,
  curvaComoParcelas,
  editaPlanoDeAportes,
  semParcelaNoMes,
} from './aportes';
import { apuracaoAnual, totalAnual } from './anual';
import { mapearAportes, mapearCustos, mapearModelInput, mapearSocios } from './mapear';
import { CATEGORIAS_CUSTO, MODOS_AMORTIZACAO } from './tipos';
import type { CustoAdicional, ModelInput, Override, RegraRateioCapital, Socio, Takedown } from './tipos';

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
    { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
  ],
  // Antes da migration 1761000000 esta premissa era a SOMA de
  // modelagem_unidades.aporte_base: 100.250 × 2 + 266.139 × 2 = 732.778. É
  // exatamente o valor que a migration semeia em modelagem_aportes.aporte_base_total,
  // e é o que mantém equityDisponivelObra em 492.778 (732.778 − 240.000 de terreno).
  aportes: {
    modoAporte: 'demanda',
    aporteBaseTotal: 732_778,
    valorTotalAlvo: 0,
    regraRateioCapital: 'participacao' as const,
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
    capitalizarJuros: false, linhaRotativa: false,
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
  },
  socios: [
    { nome: 'Sócio 1', participacaoPct: 0.5, cotaDisponivel: false, aportes: [] },
    { nome: 'Sócio 2', participacaoPct: 0.5, cotaDisponivel: false, aportes: [] },
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

/** Mesma formatação de `dinheiro` das conferências, para casar o texto. */
const dinheiroUsd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

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
    // O caso base não define teto de dívida (nem LTC, nem valor contratado), e
    // DUAS conferências acendem âmbar por causa disso — as duas avisando, não
    // reprovando:
    //   `teto_divida` — não há limite configurado;
    //   `fee_sem_base_contratada` — sem compromisso declarado, o fee incidiu
    //     sobre o pico do saldo devedor em vez do valor contratado.
    expect(out.conferencias.filter((c) => c.semaforo === 'vermelho')).toEqual([]);
    const ambares = out.conferencias.filter((c) => c.semaforo === 'ambar');
    expect(ambares.map((c) => c.chave)).toEqual(['teto_divida', 'fee_sem_base_contratada']);
    expect(ambares[0].detalhe).toContain('Nenhum teto definido');
    expect(ambares[1].detalhe).toContain('pico do saldo devedor');
    // Nenhuma das duas bloqueia o salvamento: são avisos.
    expect(bloqueiaSalvamento(out.conferencias)).toEqual([]);
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
    { nome: 'Sócio 1', participacaoPct: 0.5, cotaDisponivel: false, aportes: [] },
    { nome: 'Sócio 2', participacaoPct: 0.49, cotaDisponivel: false, aportes: [] },
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
      regraRateioCapital: 'participacao' as const,
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
        regraRateioCapital: 'participacao' as const,
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
      regraRateioCapital: 'participacao' as const,
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
      { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
    // `areaTotalSf` também sai da comparação: entrou depois, com o item 4.3, e é
    // agregado de SAÍDA como `custosPorCategoria` — não muda valor nenhum dos
    // que já existiam, e é isso que o `resto` abaixo cobra.
    const { custosPorCategoria, areaTotalSf, ...resto } = referencia.agregados;
    // O caso base não tem área por unidade, então o total é zero.
    expect(areaTotalSf).toBe(0);
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
      { label: 'Sitework', valor: 20_000, distribuicao: 'linear_construction', categoria: 'sitework', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
      { label: 'Mobilização', valor: 6_000, distribuicao: 'linear_construction', categoria: 'sitework', grupoPaiId: 1, baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
      { label: 'Amenidades', valor: 10_000, distribuicao: 'linear_construction', categoria: 'amenidades', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
      { label: 'Projeto', valor: 12_000, distribuicao: 'linear_construction', categoria: 'soft', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
      { label: 'Contingência', valor: 8_000, distribuicao: 'linear_construction', categoria: 'contingencia', baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'Ruído', valor: 9_000, distribuicao: 'linear_total', categoria: 'inexistente' as never, baseCalculo: 'total', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'Contingência', valor: 56_000, distribuicao: 'linear_construction', categoria: 'outros', baseCalculo: 'total', valorUnitario: 999, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'Taxas', valor: 0, distribuicao: 'linear_construction', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 5_200.93, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'Construção vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_unidade', valorUnitario: 385_200, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
    ];
    const porSf = comArea();
    porSf.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
    ];
    expect(JSON.stringify(calcular(porSf).meses)).toBe(JSON.stringify(calcular(porUnidade).meses));
  });

  it('acompanha a mudança de quantidade sem redigitar o custo', () => {
    // É o ponto do item: de 45 para 60 unidades, o orçamento se reajusta sozinho.
    const de45 = casoBase();
    de45.unidades = [{ nome: 'Casa', quantidade: 45, custoTerreno: 0, custoObra: 0, precoVenda: 320_000, propertyTaxAno: 0 }];
    de45.custosAdicionais = [
      { label: 'Taxas', valor: 0, distribuicao: 'linear_total', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'X', valor: 56_000, distribuicao: 'single_month' as const, mesAncora: 12, categoria: 'soft' as const, baseCalculo: 'total' as const, valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
    ] };
    const comoUnitario = { ...base, custosAdicionais: [
      { label: 'X', valor: 0, distribuicao: 'single_month' as const, mesAncora: 12, categoria: 'soft' as const, baseCalculo: 'por_unidade' as const, valorUnitario: 14_000, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
    ] };
    expect(JSON.stringify(calcular(comoUnitario).meses)).toBe(JSON.stringify(calcular(comoTotal).meses));
  });

  it('denominador zero zera o custo e acende custo_base_zerada em âmbar', () => {
    const base = casoBase();
    // Tipologias sem área: por_sf fica sem denominador.
    base.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
    ];
    const out = calcular(base);
    expect(out.agregados.custosPorCategoria.vertical).toBe(0);
    expect(semaforo(out, 'custo_base_zerada')).toBe('ambar');
    // Nunca lança, e nunca bloqueia salvamento.
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  it('linha INTEIRAMENTE zerada não acende custo_base_zerada', () => {
    // Um plano de contas em branco — valor, valor unitário e percentual todos
    // zerados — não é inconsistência: é orçamento ainda não preenchido. É o
    // estado da modelagem MODELO e o de qualquer modelagem recém-criada, e uma
    // conferência âmbar permanente ali ensina a ignorar o painel.
    const base = casoBase();
    base.custosAdicionais = [
      { label: 'Sitework', valor: 0, distribuicao: 'linear_construction', categoria: 'sitework', baseCalculo: 'por_unidade', valorUnitario: 0, percentual: 0, gatilho: 'mes_fixo' as const, parcelas: [] },
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
      { label: 'Contingência', valor: 0, distribuicao: 'linear_construction', categoria: 'contingencia', baseCalculo: 'pct_de_grupo', grupoReferencia: 'sitework', valorUnitario: 0, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
    ];
    const out = calcular(base);
    expect(semaforo(out, 'custo_base_zerada')).toBeUndefined();
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);

    // E volta a acender assim que a linha ganha valor: aí o denominador zerado
    // esconde dinheiro de verdade, que é o que a conferência existe para dizer.
    // A linha usada é a 'por_sf' — o caso base tem unidades, então 'por_unidade'
    // TEM denominador e não serviria para provar isto.
    base.custosAdicionais[1] = { ...base.custosAdicionais[1], valorUnitario: 214 };
    const comValor = calcular(base);
    expect(semaforo(comValor, 'custo_base_zerada')).toBe('ambar');
    // E nomeia só a linha que ganhou valor, não as que continuam zeradas.
    const conf = comValor.conferencias.find((c) => c.chave === 'custo_base_zerada')!;
    expect(conf.detalhe).toContain('Vertical');
    expect(conf.detalhe).not.toContain('Contingência');
  });

  it('não acende custo_base_zerada quando o denominador existe', () => {
    const base = comArea();
    base.custosAdicionais = [
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
      { label: 'Vertical', valor: 0, distribuicao: 'linear_construction', categoria: 'vertical', baseCalculo: 'por_sf', valorUnitario: 214, percentual: 0, gatilho: 'cronograma' as const, parcelas: [] },
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
  parcelas: [],
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
      custo({ label: 'Contingência', valor: 56_000, categoria: 'outros', gatilho: 'cronograma', parcelas: [] }),
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
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra', parcelas: [] }),
      custo({ label: 'Habite-se', valor: 30_000, categoria: 'soft', gatilho: 'fim_obra', parcelas: [] }),
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
      custo({ label: 'Impact fee', valor: 60_000, categoria: 'soft', distribuicao: 'linear_construction', mesAncora: 3, gatilho: 'mes_fixo', parcelas: [] }),
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
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 5_200.93, gatilho: 'por_venda', parcelas: [] }),
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
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, gatilho: 'por_venda', parcelas: [] }),
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
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, gatilho: 'por_venda', parcelas: [] }),
      // mes_fixo sem âncora: não há onde lançar.
      custo({ label: 'Taxa', valor: 5_000, categoria: 'soft', gatilho: 'mes_fixo', parcelas: [] }),
      // Âncora além do prazo de 23 meses.
      custo({ label: 'Tardia', valor: 7_000, categoria: 'soft', mesAncora: 99, gatilho: 'mes_fixo', parcelas: [] }),
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
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra', parcelas: [] }),
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
        { id: 2, ordem: 1, label: 'Fee', valor: '0.00', distribuicao: 'manual', mes_ancora: null, gatilho: 'por_venda', parcelas: [] },
        { id: 3, ordem: 2, label: 'Torta', valor: '0.00', distribuicao: 'manual', mes_ancora: null, gatilho: 'zzz', parcelas: [] },
      ],
    } as never).custosAdicionais!;
    expect(custos[0].gatilho).toBe('cronograma');
    expect(custos[1].gatilho).toBe('por_venda');
    expect(custos[2].gatilho).toBe('cronograma');
  });
});

describe('15 — fases com orçamento e cronograma próprios', () => {
  // Teste de NÃO-REGRESSÃO das fases: `usaFases = false` é o default da migration
  // 1761000000, e com ele o motor segue pelo caminho de frente única.
  //
  // A verificação do item: a obra em 2 fases soma o MESMO obraTotal da
  // distribuição linear única — só muda a posição no tempo.
  const semFases = calcular(casoBase());

  const duasFases = [
    { ordem: 0, nome: 'PH1', dataInicio: '2026-10-01', dataFim: '2027-01-31' },
    { ordem: 1, nome: 'PH2', dataInicio: '2027-02-01', dataFim: '2027-05-31' },
  ];

  it('usaFases = false não muda nada, mesmo com fases cadastradas', () => {
    const base = casoBase();
    // Fases e alocação GRAVADAS mas com o switch desligado: input do usuário fica
    // guardado e inativo, e o resultado é o de sempre.
    base.usaFases = false;
    base.fases = duasFases;
    base.alocacoes = [
      { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
      { unidadeIndex: 3, faseIndex: 1, quantidade: 1 },
    ];
    const out = calcular(base);
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(semFases.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(semFases.apuracao));
    expect(JSON.stringify(out.indicadores)).toBe(JSON.stringify(semFases.indicadores));
    // Nenhuma conferência de fase aparece: todas são condicionais ao switch.
    expect(out.conferencias.map((c) => c.chave)).toEqual(semFases.conferencias.map((c) => c.chave));
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  it('Σ construction é idêntico com e sem fases — só muda a posição no tempo', () => {
    const base = casoBase();
    base.usaFases = true;
    base.fases = duasFases;
    base.alocacoes = [
      { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
      { unidadeIndex: 3, faseIndex: 1, quantidade: 1 },
    ];
    const comFases = calcular(base);

    const totalSem = soma(semFases.meses.map((m) => m.construction));
    const totalCom = soma(comFases.meses.map((m) => m.construction));
    expect(totalCom).toBeCloseTo(totalSem, 6);
    expect(totalCom).toBeCloseTo(comFases.agregados.obraTotal, 6);
    // O cronograma global continua mandando no prazo: as fases se encaixam nele.
    expect(comFases.cronograma.prazoTotal).toBe(semFases.cronograma.prazoTotal);
    // E a posição no tempo MUDOU — senão o teste acima não provaria nada.
    expect(JSON.stringify(comFases.meses.map((m) => m.construction))).not.toBe(
      JSON.stringify(semFases.meses.map((m) => m.construction)),
    );
  });

  it('alocação que não fecha bloqueia o salvamento, junto das outras duas', () => {
    const base = casoBase();
    base.usaFases = true;
    base.fases = duasFases;
    base.alocacoes = [{ unidadeIndex: 0, faseIndex: 0, quantidade: 1 }]; // faltam 3
    const out = calcular(base);
    expect(semaforo(out, 'alocacao_fases')).toBe('vermelho');
    expect(bloqueiaSalvamento(out.conferencias).map((c) => c.chave)).toEqual(['alocacao_fases']);
    // Bloquear o SALVAMENTO nunca é bloquear o CÁLCULO.
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
  });
});

describe('16 — takedown schedule', () => {
  // Teste de NÃO-REGRESSÃO da migration 1761800000: 'takedown' é um modo NOVO, e
  // nenhuma modelagem já salva o tem.
  const referencia = calcular(casoBase());

  it('os três modos antigos continuam idênticos', () => {
    for (const modo of ['single_exit', 'per_unit', 'manual'] as const) {
      const base = casoBase();
      base.receita.modoVenda = modo;
      if (modo === 'per_unit') {
        base.receita.vendasPorUnidade = [
          { unidadeIndex: 0, mesVenda: 20 },
          { unidadeIndex: 1, mesVenda: 20 },
          { unidadeIndex: 2, mesVenda: 23 },
          { unidadeIndex: 3, mesVenda: 23 },
        ];
      }
      // Takedowns GRAVADOS mas com outro modo ativo: ficam guardados e inertes.
      base.receita.takedowns = [
        { unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 5, quantidade: 1, precoUnitario: 999_999 },
      ];
      const out = calcular(base);
      const semTakedowns = calcular({ ...base, receita: { ...base.receita, takedowns: [] } });
      expect(JSON.stringify(out.meses)).toBe(JSON.stringify(semTakedowns.meses));
      expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(semTakedowns.apuracao));
      // E nenhuma conferência de takedown aparece fora do modo.
      for (const chave of [
        'takedown_quantidade', 'takedown_incompleto', 'takedown_fora_prazo', 'takedown_antes_da_fase',
      ]) {
        expect(semaforo(out, chave)).toBeUndefined();
      }
    }
    // O caso base — single_exit — segue bit a bit o de sempre.
    expect(JSON.stringify(calcular(casoBase()).meses)).toBe(JSON.stringify(referencia.meses));
  });

  /** 45 casas a $875.000, vendidas em 12 levas de 4 e 3 a partir do mês 12. */
  const casoTakedown = (): ModelInput => {
    const base = casoBase();
    base.unidades = [
      { nome: 'Casa', quantidade: 45, custoTerreno: 0, custoObra: 0, precoVenda: 875_000, propertyTaxAno: 0 },
    ];
    base.receita.comissaoPct = 0;
    base.receita.custoCartorioPct = 0;
    base.receita.modoVenda = 'takedown';
    const levas = [4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3]; // 45 unidades em 12 meses
    base.receita.takedowns = levas.map((quantidade, k) => ({
      unidadeIndex: 0,
      faseIndex: null,
      ordem: k,
      mes: 12 + k,
      quantidade,
      // 0 = usar o preço da tipologia.
      precoUnitario: 0,
    }));
    return base;
  };

  it('12 levas de 3-4 unidades somam 45 unidades e $39.375.000 de receita bruta', () => {
    const out = calcular(casoTakedown());
    // 45 × 875.000 = 39.375.000.
    expect(out.agregados.unidadesTotal).toBe(45);
    expect(out.apuracao.receitaBruta).toBeCloseTo(39_375_000, 2);
    expect(soma(out.meses.map((m) => m.revenue))).toBeCloseTo(39_375_000, 2);
    // Sem comissão nem cartório, o lançado bate com o apurado: verde.
    expect(semaforo(out, 'receita_lancada')).toBe('verde');
    expect(semaforo(out, 'takedown_quantidade')).toBe('verde');
    expect(semaforo(out, 'takedown_incompleto')).toBe('verde');
  });

  it('o revenue mensal bate leva a leva', () => {
    const out = calcular(casoTakedown());
    const levas = [4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3];
    levas.forEach((n, k) => {
      expect(out.meses[12 + k - 1].revenue).toBeCloseTo(n * 875_000, 2);
    });
    // E em nenhum outro mês.
    const comReceita = out.meses.filter((m) => m.revenue > 0).map((m) => m.mes);
    expect(comReceita).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });

  it('expõe unidadesVendidasPorMes alinhado com meses', () => {
    const out = calcular(casoTakedown());
    expect(out.unidadesVendidasPorMes).toHaveLength(out.meses.length);
    expect(soma(out.unidadesVendidasPorMes)).toBe(45);
    expect(out.unidadesVendidasPorMes[11]).toBe(4); // mês 12
    expect(out.unidadesVendidasPorMes[20]).toBe(3); // mês 21
    expect(out.unidadesVendidasPorMes[0]).toBe(0);
  });

  it('é a MESMA grandeza que o gatilho de custo por_venda usa', () => {
    // As duas leituras saem do mesmo mapa: se divergirem, é bug.
    const base = casoTakedown();
    base.custosAdicionais = [
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 1_000, gatilho: 'por_venda', parcelas: [] }),
    ];
    const out = calcular(base);
    out.meses.forEach((m, k) => {
      expect(m.otherCosts).toBeCloseTo(out.unidadesVendidasPorMes[k] * 1_000, 6);
    });
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(45_000, 2);
  });

  it('preço 0 usa o da tipologia; preço próprio sobrepõe', () => {
    const base = casoTakedown();
    base.receita.takedowns = [
      { unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 12, quantidade: 20, precoUnitario: 0 },
      { unidadeIndex: 0, faseIndex: null, ordem: 1, mes: 13, quantidade: 25, precoUnitario: 900_000 },
    ];
    const out = calcular(base);
    expect(out.meses[11].revenue).toBeCloseTo(20 * 875_000, 2);
    expect(out.meses[12].revenue).toBeCloseTo(25 * 900_000, 2);
    // O preço próprio afasta o lançado do VGV apurado — e a conferência que já
    // existia acusa, sem precisar de regra nova.
    expect(semaforo(out, 'receita_lancada')).toBe('ambar');
  });

  it('dois lotes no mesmo mês somam em vez de um sobrescrever o outro', () => {
    const base = casoTakedown();
    base.receita.takedowns = [
      { unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 12, quantidade: 20, precoUnitario: 0 },
      { unidadeIndex: 0, faseIndex: null, ordem: 1, mes: 12, quantidade: 25, precoUnitario: 0 },
    ];
    const out = calcular(base);
    expect(out.meses[11].revenue).toBeCloseTo(45 * 875_000, 2);
    expect(out.unidadesVendidasPorMes[11]).toBe(45);
  });

  it('acusa em vermelho quem vende mais unidades do que a tipologia tem', () => {
    const base = casoTakedown();
    base.receita.takedowns = [
      { unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 12, quantidade: 50, precoUnitario: 0 },
    ];
    const out = calcular(base);
    expect(semaforo(out, 'takedown_quantidade')).toBe('vermelho');
    expect(out.conferencias.find((c) => c.chave === 'takedown_quantidade')?.detalhe).toContain('50 de 45');
    // Vermelho, mas NÃO bloqueia salvamento nem cálculo.
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
  });

  it('acusa em âmbar a unidade que sobrou sem lote', () => {
    const base = casoTakedown();
    base.receita.takedowns = [
      { unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 12, quantidade: 40, precoUnitario: 0 },
    ];
    const out = calcular(base);
    const conf = out.conferencias.find((c) => c.chave === 'takedown_incompleto');
    expect(conf?.semaforo).toBe('ambar');
    expect(conf?.valor).toBe('5');
    expect(soma(out.meses.map((m) => m.revenue))).toBeCloseTo(40 * 875_000, 2);
  });

  it('lote fora do prazo fica guardado, não é lançado e acende âmbar', () => {
    const base = casoTakedown();
    base.receita.takedowns = [
      { unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 12, quantidade: 40, precoUnitario: 0 },
      { unidadeIndex: 0, faseIndex: null, ordem: 1, mes: 99, quantidade: 5, precoUnitario: 0 },
    ];
    const out = calcular(base);
    expect(semaforo(out, 'takedown_fora_prazo')).toBe('ambar');
    // Não lançado, mas não apagado: o input continua no array de entrada.
    expect(soma(out.meses.map((m) => m.revenue))).toBeCloseTo(40 * 875_000, 2);
    expect(base.receita.takedowns).toHaveLength(2);
    // A quantidade declarada fecha, então `takedown_incompleto` fica verde: o
    // problema é o mês, e é a conferência do mês que tem de acusar.
    expect(semaforo(out, 'takedown_incompleto')).toBe('verde');
  });

  it('acusa em âmbar a venda anterior à conclusão da fase', () => {
    const base = casoTakedown();
    base.usaFases = true;
    base.fases = [{ ordem: 0, nome: 'PH1', dataInicio: '2026-10-01', dataFim: '2027-05-31' }];
    base.alocacoes = [{ unidadeIndex: 0, faseIndex: 0, quantidade: 45 }];
    base.receita.takedowns = [
      // A fase conclui no mês 18; este lote vende no 12 — venda na planta.
      { unidadeIndex: 0, faseIndex: 0, ordem: 0, mes: 12, quantidade: 45, precoUnitario: 0 },
    ];
    const out = calcular(base);
    expect(out.cronograma.fases[0].mesFim).toBe(18);
    expect(semaforo(out, 'takedown_antes_da_fase')).toBe('ambar');
    // Sem fase declarada no lote, não há o que comparar: verde.
    const semFase = calcular({
      ...base,
      receita: {
        ...base.receita,
        takedowns: (base.receita.takedowns ?? []).map((t) => ({ ...t, faseIndex: null })),
      },
    });
    expect(semaforo(semFase, 'takedown_antes_da_fase')).toBe('verde');
  });

  it('override em revenue continua vencendo o takedown', () => {
    const base = casoTakedown();
    base.overrides = [{ mes: 12, linha: 'revenue', valor: 1_234 }];
    const out = calcular(base);
    expect(out.meses[11].revenue).toBe(1_234);
  });

  it('mapeia takedowns do banco por id, com o Map<id, índice> das tipologias', () => {
    const input = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      meses_aprovacao: 10,
      meses_construcao: 8,
      meses_pos_obra: 5,
      unidades: [
        { id: 41, ordem: 0, nome: 'A', quantidade: 2, custo_terreno: '0', custo_obra: '0', preco_venda: '875000.00', property_tax_ano: '0' },
        { id: 42, ordem: 1, nome: 'B', quantidade: 3, custo_terreno: '0', custo_obra: '0', preco_venda: '900000.00', property_tax_ano: '0' },
      ],
      fases: [{ id: 71, ordem: 0, nome: 'PH1', data_inicio: '2026-10-01', data_fim: '2027-01-31' }],
      receita: { modo_venda: 'takedown', comissao_pct: '0', custo_cartorio_pct: '0', lucro_investidores_pct: '0.8', lucro_sponsor_pct: '0.2' },
      takedowns: [
        // DECIMAL(15,2) chega como STRING — sem num(), "875000.00" × 2 seria
        // concatenação e a receita sairia errada sem erro nenhum.
        { id: 1, ordem: 0, unidade_id: 41, fase_id: 71, mes: 12, quantidade: 2, preco_unitario: '875000.00', observacao: null },
        { id: 2, ordem: 1, unidade_id: 42, fase_id: null, mes: 13, quantidade: 3, preco_unitario: '0.00', observacao: 'sem preço próprio' },
        // Aponta para tipologia que não existe: descartado.
        { id: 3, ordem: 2, unidade_id: 999, fase_id: null, mes: 14, quantidade: 1, preco_unitario: '0.00', observacao: null },
      ],
    } as never);

    const t = input.receita.takedowns!;
    expect(t).toHaveLength(2);
    expect(t[0].unidadeIndex).toBe(0);
    expect(t[0].faseIndex).toBe(0);
    expect(t[0].precoUnitario).toBe(875_000);
    expect(t[1].unidadeIndex).toBe(1);
    expect(t[1].faseIndex).toBeNull();
    expect(t[1].precoUnitario).toBe(0);

    // E o motor lê isso sem erro: 2 × 875.000 no mês 12, 3 × 900.000 no 13.
    const out = calcular(input);
    expect(out.meses[11].revenue).toBeCloseTo(1_750_000, 2);
    expect(out.meses[12].revenue).toBeCloseTo(2_700_000, 2);
  });
});

/** Caso base com o financiamento ajustado — os defaults novos vêm de `casoBase`. */
const comFin = (patch: Partial<ModelInput['financiamento']>): ModelInput => {
  const base = casoBase();
  base.financiamento = { ...base.financiamento, ...patch };
  return base;
};

describe('17 — reserva de juros', () => {
  // Teste de NÃO-REGRESSÃO da migration 1762100000: com reserva 0 não há saldo
  // para absorver juro nenhum, e cada mês cai exatamente no caminho de hoje.
  const referencia = calcular(casoBase());

  it('reserva 0 produz o resultado idêntico ao de hoje', () => {
    // reservaJurosSacada preenchido é INERTE sem valor de reserva.
    const out = calcular(comFin({ reservaJuros: 0, reservaJurosSacada: false }));
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(out.indicadores)).toBe(JSON.stringify(referencia.indicadores));
    expect(out.conferencias.map((c) => c.chave)).toEqual(referencia.conferencias.map((c) => c.chave));
    // Os campos novos existem e ficam neutros.
    expect(out.meses.every((m) => m.jurosPagosPelaReserva === 0)).toBe(true);
    expect(out.meses.every((m) => m.saldoReservaJuros === 0)).toBe(true);
    expect(out.meses.every((m) => m.saqueReservaJuros === 0)).toBe(true);
  });

  it('reserva igual ao juro total zera o custo financeiro de caixa', () => {
    // A verificação do item. A reserva orçamentária é usada porque a sacada
    // aumenta o principal e, com ele, o próprio juro — o ponto fixo não fecharia
    // num número redondo.
    const jurosDeReferencia = referencia.apuracao.jurosTotais;
    const out = calcular(
      comFin({ reservaJuros: jurosDeReferencia, reservaJurosSacada: false }),
    );
    // Os juros incorridos não mudam: a reserva paga, não elimina.
    expect(out.apuracao.jurosTotais).toBeCloseTo(jurosDeReferencia, 2);
    // Mas nenhum centavo de juro sai do caixa — só sobra o fee.
    for (const m of out.meses) {
      expect(m.custoFinanceiroCaixa).toBeCloseTo(m.fee, 6);
    }
    expect(soma(out.meses.map((m) => m.jurosPagosPelaReserva))).toBeCloseTo(jurosDeReferencia, 2);
  });

  it('a reserva sacada soma ao principal e não passa pelo caixa', () => {
    const out = calcular(comFin({ reservaJuros: 100_000, reservaJurosSacada: true }));
    const mesConstituicao = out.meses.find((m) => m.saqueReservaJuros > 0)!;
    // Constituída no PRIMEIRO saque, uma única vez.
    expect(out.meses.filter((m) => m.saqueReservaJuros > 0)).toHaveLength(1);
    expect(mesConstituicao.saqueReservaJuros).toBe(100_000);
    expect(mesConstituicao.mes).toBe(out.meses.find((m) => m.draw > 0)!.mes);
    // Entra na dívida sacada...
    expect(out.apuracao.dividaSacada).toBeCloseTo(
      soma(out.meses.map((m) => m.draw)) + 100_000,
      2,
    );
    // ...mas NÃO no caixa: o caixa do mês ignora o saque da reserva.
    expect(mesConstituicao.caixaMes).toBeCloseTo(
      mesConstituicao.equityCall +
        mesConstituicao.draw +
        mesConstituicao.revenue -
        mesConstituicao.pagamentos -
        mesConstituicao.amortization -
        mesConstituicao.distribution,
      6,
    );
    // E a dívida continua quitada no fim.
    expect(semaforo(out, 'saldo_devedor_final')).toBe('verde');
  });

  it('a reserva orçamentária não mexe na dívida nem na chamada de capital', () => {
    const out = calcular(comFin({ reservaJuros: 100_000, reservaJurosSacada: false }));
    expect(out.meses.every((m) => m.saqueReservaJuros === 0)).toBe(true);
    expect(out.apuracao.dividaSacada).toBeCloseTo(soma(out.meses.map((m) => m.draw)), 2);
    // O efeito é só o juro deixar de sair do caixa — e por isso o equity total
    // fica MENOR que o do caso sem reserva.
    expect(out.apuracao.equityTotal).toBeLessThan(referencia.apuracao.equityTotal);
  });

  it('reserva primeiro, capitalização depois — nessa ordem', () => {
    // Com a ordem invertida o juro viraria principal antes de a reserva ter
    // chance de absorvê-lo, e a reserva nunca esvaziaria.
    const out = calcular(
      comFin({ reservaJuros: 50_000, reservaJurosSacada: false, capitalizarJuros: true }),
    );
    const primeiroComJuros = out.meses.find((m) => m.juros > 0)!;
    expect(primeiroComJuros.jurosPagosPelaReserva).toBeGreaterThan(0);
    // A reserva de fato drena.
    expect(out.meses[out.meses.length - 1].saldoReservaJuros).toBeLessThan(50_000);
  });

  it('acende âmbar no mês em que a reserva acaba e quando sobra', () => {
    const esgota = calcular(comFin({ reservaJuros: 20_000, reservaJurosSacada: false }));
    const conf = esgota.conferencias.find((c) => c.chave === 'reserva_juros_esgotada');
    expect(conf?.semaforo).toBe('ambar');
    expect(conf?.valor).toMatch(/^mês \d+$/);
    expect(semaforo(esgota, 'reserva_juros_sobrando')).toBe('verde');

    const sobra = calcular(comFin({ reservaJuros: 5_000_000, reservaJurosSacada: false }));
    expect(semaforo(sobra, 'reserva_juros_esgotada')).toBe('verde');
    expect(semaforo(sobra, 'reserva_juros_sobrando')).toBe('ambar');
    expect(bloqueiaSalvamento(sobra.conferencias)).toHaveLength(0);
  });
});

describe('18 — amortização: só release e quitação na saída', () => {
  // Sobraram DOIS modos: 'at_exit' e 'manual'. 'price' e 'sac' foram removidos
  // pela migration 1763400000 — a essa altura já produziam exatamente o mesmo
  // ModelOutput que 'manual', e as linhas gravadas foram convertidas para ele.
  const referencia = calcular(casoBase());

  it('só existem dois modos de amortização', () => {
    expect(MODOS_AMORTIZACAO).toEqual(['at_exit', 'manual']);
  });

  it("at_exit produz o resultado de sempre, e os campos de prestação não têm efeito", () => {
    // `prazoMeses`, `carenciaMeses`, `amortizacaoMeses` e `balloonNoVencimento`
    // continuam no input por compatibilidade e são INERTES: preenchidos com
    // valores absurdos, o fluxo é byte a byte o mesmo.
    const out = calcular(
      comFin({
        modoAmortizacao: 'at_exit',
        prazoMeses: 20,
        carenciaMeses: 20,
        amortizacaoMeses: 300,
        balloonNoVencimento: true,
      }),
    );
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(out.conferencias.map((c) => c.chave)).toEqual(referencia.conferencias.map((c) => c.chave));
  });

  it('manual não amortiza nada sozinho — sem release, sem amortização', () => {
    const out = calcular(
      comFin({
        modoSaque: 'cash_demand',
        modoAmortizacao: 'manual',
        mesInicioSaque: 1,
        mesFimSaque: 10,
        prazoMeses: 20,
        carenciaMeses: 2,
        amortizacaoMeses: 23,
        balloonNoVencimento: true,
      }),
    );
    expect(out.meses.every((m) => m.amortization === 0)).toBe(true);
    // E o saldo fica em aberto no fim — a conferência acusa em vermelho, que é
    // como o motor mostra o que não fecha em vez de esconder.
    expect(out.meses[out.meses.length - 1].saldoDevedor).toBeGreaterThan(0);
    expect(semaforo(out, 'saldo_devedor_final')).toBe('vermelho');
  });

  it('em manual o release é a única amortização automática', () => {
    const out = calcular({
      ...comFin({
        modoSaque: 'cash_demand',
        modoAmortizacao: 'manual',
        mesInicioSaque: 1,
        mesFimSaque: 10,
        releasePrice: 200_000,
      }),
      receita: {
        ...casoBase().receita,
        modoVenda: 'per_unit',
        vendasPorUnidade: [
          { unidadeIndex: 0, mesVenda: 19 },
          { unidadeIndex: 1, mesVenda: 20 },
          { unidadeIndex: 2, mesVenda: 21 },
          { unidadeIndex: 3, mesVenda: 22 },
        ],
      },
    });
    // Só os meses de venda amortizam — e só enquanto há dívida: nos meses 21 e
    // 22 o saldo de abertura já é zero e o release não tem o que amortizar.
    const comAmort = out.meses.filter((m) => m.amortization > 0).map((m) => m.mes);
    expect(comAmort).toEqual([19, 20]);
    expect(out.meses[20].saldoDevedor).toBe(0);
    for (const m of out.meses) {
      expect(m.amortizacaoRelease).toBeCloseTo(m.amortization, 6);
    }
    const conf = out.conferencias.find((c) => c.chave === 'release_insuficiente')!;
    expect(conf.semaforo).toBe('ambar');
    expect(conf.detalhe).toMatch(/de release não chegaram a ser amortizados/);
  });

  it('as conferências de prestação saíram junto com os modos', () => {
    // Nenhuma modelagem produz mais `amortizacao_alem_do_prazo` nem
    // `balloon_sem_caixa`: as duas só faziam sentido com vencimento e balloon.
    for (const modo of MODOS_AMORTIZACAO) {
      const out = calcular(comFin({ modoAmortizacao: modo, prazoMeses: 60, amortizacaoMeses: 300 }));
      const chaves = out.conferencias.map((c) => c.chave);
      expect(chaves).not.toContain('amortizacao_alem_do_prazo');
      expect(chaves).not.toContain('balloon_sem_caixa');
    }
  });

  it('override de amortização continua vencendo tudo', () => {
    const base = comFin({ modoSaque: 'cash_demand', modoAmortizacao: 'manual', mesInicioSaque: 1, mesFimSaque: 10 });
    base.overrides = [{ mes: 20, linha: 'amortization', valor: 1_000 }];
    const comOverride = calcular(base);
    expect(comOverride.meses[19].amortization).toBe(1_000);
    // Sem o override o mês não amortizaria nada.
    expect(
      calcular(comFin({ modoSaque: 'cash_demand', modoAmortizacao: 'manual', mesInicioSaque: 1, mesFimSaque: 10 }))
        .meses[19].amortization,
    ).toBe(0);
  });
});

describe('19 — release price por unidade vendida', () => {
  // Teste de NÃO-REGRESSÃO da migration 1762300000.
  const referencia = calcular(casoBase());

  it('sem release o resultado é idêntico ao de hoje', () => {
    const out = calcular(comFin({ releasePrice: 0, releasePricePct: null }));
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(out.conferencias.map((c) => c.chave)).toEqual(referencia.conferencias.map((c) => c.chave));
  });

  /** 45 unidades a $875.000 em 12 takedowns, com release de $43.500. */
  const comTakedown = (patch: Partial<ModelInput['financiamento']>): ModelInput => {
    const base = comFin({ modoSaque: 'cash_demand', mesInicioSaque: 1, mesFimSaque: 11, ...patch });
    base.unidades = [
      { nome: 'Casa', quantidade: 45, custoTerreno: 10_000, custoObra: 400_000, precoVenda: 875_000, propertyTaxAno: 0 },
    ];
    base.receita.modoVenda = 'takedown';
    const levas = [4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3];
    base.receita.takedowns = levas.map((quantidade, k) => ({
      unidadeIndex: 0, faseIndex: null, ordem: k, mes: 12 + k, quantidade, precoUnitario: 0,
    }));
    return base;
  };

  it('45 unidades com release de $43.500 amortizam $1.957.500 em degraus', () => {
    const out = calcular(comTakedown({ releasePrice: 43_500 }));
    // 45 × 43.500 = 1.957.500.
    expect(soma(out.unidadesVendidasPorMes)).toBe(45);
    // A amortização acontece exatamente nos meses de takedown, em degraus.
    const mesesComAmort = out.meses.filter((m) => m.amortization > 0).map((m) => m.mes);
    expect(mesesComAmort).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
    // Mês de 4 unidades amortiza o dobro… do de 2, e 4/3 do de 3.
    expect(out.meses[11].amortization).toBeCloseTo(4 * 43_500, 2);
    expect(out.meses[20].amortization).toBeCloseTo(3 * 43_500, 2);
    // O saldo devedor cai em degraus, nunca sobe depois do último saque.
    for (let k = 12; k < out.meses.length; k++) {
      expect(out.meses[k].saldoDevedor).toBeLessThanOrEqual(out.meses[k - 1].saldoDevedor + 1e-6);
    }
  });

  it('o percentual é lido só quando o valor fixo é zero', () => {
    const fixo = calcular(comTakedown({ releasePrice: 43_500, releasePricePct: 0.9 }));
    const soPct = calcular(comTakedown({ releasePrice: 0, releasePricePct: 43_500 / 875_000 }));
    // Com os dois preenchidos vale o FIXO — logo os dois casos batem.
    expect(fixo.meses[11].amortization).toBeCloseTo(soPct.meses[11].amortization, 2);
    expect(fixo.meses[11].amortization).toBeCloseTo(4 * 43_500, 2);
  });

  it('acusa release que não quita a dívida e release acima do preço líquido', () => {
    // Amortização manual: sem ela, o at_exit quitaria o resto no mês da saída e
    // nunca sobraria saldo para a conferência acusar.
    const pouco = calcular(comTakedown({ releasePrice: 1_000, modoAmortizacao: 'manual' }));
    expect(semaforo(pouco, 'release_insuficiente')).toBe('ambar');

    // Preço líquido = 875.000 × (1 − 0,06 − 0,02) = 805.000.
    const demais = calcular(comTakedown({ releasePrice: 900_000 }));
    expect(semaforo(demais, 'release_acima_da_receita')).toBe('vermelho');
    expect(bloqueiaSalvamento(demais.conferencias)).toHaveLength(0);
    expect(Number.isFinite(demais.apuracao.lucroProjeto)).toBe(true);
  });

  it('o release soma à amortização do modo escolhido', () => {
    const base = comTakedown({ releasePrice: 10_000, modoAmortizacao: 'at_exit' });
    const out = calcular(base);
    // No mês da saída convivem o release do próprio mês e a quitação do at_exit.
    const mesSaida = out.cronograma.mesSaida;
    expect(out.meses[mesSaida - 1].amortization).toBeGreaterThan(3 * 10_000);
    expect(out.meses[mesSaida - 1].saldoDevedor).toBeCloseTo(0, 2);
  });
});

describe('20 — convenção de juros por dias corridos', () => {
  const referencia = calcular(casoBase());

  it('mensal_12 produz exatamente os números de hoje', () => {
    const out = calcular(comFin({ convencaoJuros: 'mensal_12' }));
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
  });

  it('30/360 é aritmeticamente igual a mensal_12', () => {
    // 30/360 = 1/12 exato. Existe para o usuário declarar a convenção do
    // contrato, não para mudar o resultado.
    const out = calcular(comFin({ convencaoJuros: '30_360' }));
    expect(out.apuracao.jurosTotais).toBeCloseTo(referencia.apuracao.jurosTotais, 6);
  });

  it('actual_360 cobra ~1,39% a mais que mensal_12 num ano de 365 dias', () => {
    // Projeto de 12 meses cheios, começando em janeiro de um ano não bissexto.
    const base = comFin({
      convencaoJuros: 'actual_360',
      modoSaque: 'manual',
      mesInicioSaque: 1,
      mesFimSaque: 1,
      modoAmortizacao: 'manual',
    });
    base.dataInicio = '2025-01-01';
    base.mesesAprovacao = 12;
    base.mesesConstrucao = 0;
    base.mesesPosObra = 0;
    base.receita.mesSaida = 12;
    // Saldo constante de 1.000.000 o ano inteiro, por override.
    base.overrides = [{ mes: 1, linha: 'draw', valor: 1_000_000 }];

    const atual360 = calcular(base);
    const mensal = calcular({ ...base, financiamento: { ...base.financiamento, convencaoJuros: 'mensal_12' } });
    const razaoJuros = atual360.apuracao.jurosTotais / mensal.apuracao.jurosTotais;
    // 365 / 360 = 1,013888…
    expect(razaoJuros).toBeCloseTo(365 / 360, 6);
    expect(razaoJuros).toBeGreaterThan(1.0138);

    const atual365 = calcular({ ...base, financiamento: { ...base.financiamento, convencaoJuros: 'actual_365' } });
    // Base 365 sobre um ano de 365 dias dá exatamente a taxa anual.
    expect(atual365.apuracao.jurosTotais / mensal.apuracao.jurosTotais).toBeCloseTo(1, 6);
  });

  it('fatorJurosDoMes é puro e conta os dias reais do mês', () => {
    expect(fatorJurosDoMes('mensal_12', 0.12, '2025-02-01')).toBeCloseTo(0.01, 12);
    expect(fatorJurosDoMes('30_360', 0.12, '2025-02-01')).toBeCloseTo(0.01, 12);
    // Fevereiro comum tem 28 dias; bissexto, 29.
    expect(fatorJurosDoMes('actual_360', 0.12, '2025-02-01')).toBeCloseTo((0.12 * 28) / 360, 12);
    expect(fatorJurosDoMes('actual_360', 0.12, '2024-02-01')).toBeCloseTo((0.12 * 29) / 360, 12);
    expect(fatorJurosDoMes('actual_365', 0.12, '2025-01-01')).toBeCloseTo((0.12 * 31) / 365, 12);
    // Duas chamadas iguais dão o mesmo: nada de relógio.
    expect(fatorJurosDoMes('actual_360', 0.095, '2025-07-01')).toBe(
      fatorJurosDoMes('actual_360', 0.095, '2025-07-01'),
    );
  });
});

describe('21 — taxa variável: benchmark mais spread', () => {
  const referencia = calcular(casoBase());

  it("tipo_taxa = 'fixa' reproduz o resultado atual", () => {
    // Spread e benchmark preenchidos são INERTES no modo fixo.
    const out = calcular(comFin({ tipoTaxa: 'fixa', spread: 0.5, benchmarkPadrao: 0.9 }));
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(out.conferencias.map((c) => c.chave)).toEqual(referencia.conferencias.map((c) => c.chave));
    expect(out.meses.every((m) => m.taxaEfetivaAno === 0.095)).toBe(true);
  });

  it('curva constante igual à taxa fixa menos o spread dá o mesmo juro', () => {
    // A verificação do item.
    const spread = 0.02;
    const base = comFin({
      tipoTaxa: 'variavel',
      spread,
      benchmarkPadrao: 0.095 - spread,
      benchmarkCurva: Array.from({ length: 23 }, (_, k) => ({ mes: k + 1, valor: 0.095 - spread })),
    });
    const out = calcular(base);
    expect(out.apuracao.jurosTotais).toBeCloseTo(referencia.apuracao.jurosTotais, 6);
    expect(out.meses.every((m) => Math.abs(m.taxaEfetivaAno - 0.095) < 1e-12)).toBe(true);
    expect(semaforo(out, 'benchmark_incompleto')).toBe('verde');
  });

  it('mês sem ponto na curva usa o padrão, e a conferência diz quantos', () => {
    const base = comFin({
      tipoTaxa: 'variavel',
      spread: 0.02,
      benchmarkPadrao: 0.075,
      // Só três meses declarados, dos 23.
      benchmarkCurva: [
        { mes: 1, valor: 0.05 },
        { mes: 2, valor: 0.06 },
        // Ponto com valor ZERO: declara benchmark zero, e é diferente de ausente.
        { mes: 3, valor: 0 },
      ],
    });
    const out = calcular(base);
    expect(out.meses[0].taxaEfetivaAno).toBeCloseTo(0.07, 12); // 0,05 + 0,02
    expect(out.meses[2].taxaEfetivaAno).toBeCloseTo(0.02, 12); // 0 + 0,02, não o padrão
    expect(out.meses[3].taxaEfetivaAno).toBeCloseTo(0.095, 12); // padrão 0,075 + 0,02
    const conf = out.conferencias.find((c) => c.chave === 'benchmark_incompleto');
    expect(conf?.semaforo).toBe('ambar');
    expect(conf?.valor).toBe('20');
    expect(bloqueiaSalvamento(out.conferencias)).toHaveLength(0);
  });

  it('a taxa variável alimenta a convenção de juros do item anterior', () => {
    // Os dois recursos compõem: a convenção conta os dias, a curva dá a taxa.
    const base = comFin({
      tipoTaxa: 'variavel',
      convencaoJuros: 'actual_360',
      spread: 0.02,
      benchmarkPadrao: 0.075,
    });
    const out = calcular(base);
    const m = out.meses.find((x) => x.saldoDevedor > 0 && x.juros > 0)!;
    expect(m.taxaEfetivaAno).toBeCloseTo(0.095, 12);
    expect(m.juros / (m.saldoDevedor + m.amortization)).toBeCloseTo(
      fatorJurosDoMes('actual_360', 0.095, m.data),
      9,
    );
  });

  it('mapeia o financiamento novo do banco, com os defaults para linha antiga', () => {
    const input = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      meses_aprovacao: 10, meses_construcao: 8, meses_pos_obra: 5,
      // Linha gravada ANTES das migrations 1762100000..1762500000.
      financiamento: {
        taxa_anual: '0.0950', fee_estruturacao_pct: '0.0150', fee_timing: 'first_draw',
        mes_inicio_saque: 13, mes_fim_saque: 23, modo_saque: 'equity_first',
        modo_amortizacao: 'at_exit', colchao_minimo_caixa: '0.00',
      },
    } as never);
    const f = input.financiamento;
    expect(f.reservaJuros).toBe(0);
    expect(f.reservaJurosSacada).toBe(true); // DEFAULT TRUE da coluna
    expect(f.prazoMeses).toBeNull();
    expect(f.carenciaMeses).toBe(0);
    expect(f.balloonNoVencimento).toBe(true);
    expect(f.releasePrice).toBe(0);
    expect(f.releasePricePct).toBeNull(); // nulo ≠ zero: "não usar"
    expect(f.convencaoJuros).toBe('mensal_12');
    expect(f.tipoTaxa).toBe('fixa');
    expect(f.benchmarkCurva).toEqual([]);

    // E os DECIMAL que chegam como STRING passam por num().
    const comCurva = mapearModelInput({
      id: 7,
      data_inicio: '2025-12-01',
      financiamento: {
        taxa_anual: '0.0950', tipo_taxa: 'variavel', spread: '0.020000',
        benchmark_padrao: '0.075000', reserva_juros: '100000.00',
        reserva_juros_sacada: false, convencao_juros: 'actual_360',
        modo_amortizacao: 'price', prazo_meses: 20, carencia_meses: 6,
        amortizacao_meses: 300, release_price: '43500.00', release_price_pct: '0.300000',
      },
      benchmark_curva: [
        { id: 1, mes: 2, valor: '0.060000' },
        { id: 2, mes: 1, valor: '0.050000' },
      ],
    } as never).financiamento;
    expect(comCurva.spread).toBe(0.02);
    expect(comCurva.reservaJuros).toBe(100_000);
    expect(comCurva.reservaJurosSacada).toBe(false);
    expect(comCurva.convencaoJuros).toBe('actual_360');
    // Linha gravada em 'price' (modo removido pela 1763400000) mapeia para
    // 'manual', que é o resultado que ela já produzia — não para 'at_exit', que
    // acrescentaria uma quitação no mês da saída.
    expect(comCurva.modoAmortizacao).toBe('manual');
    expect(comCurva.releasePrice).toBe(43_500);
    expect(comCurva.releasePricePct).toBe(0.3);
    // Ordenada por mês, e os valores viraram número de verdade.
    expect(comCurva.benchmarkCurva).toEqual([
      { id: 2, mes: 1, valor: 0.05 },
      { id: 1, mes: 2, valor: 0.06 },
    ]);
  });
});

describe('22 — indicadores por unidade e por pé quadrado', () => {
  // Derivação PURA de apuracao e agregados: nenhum input novo, nenhuma migration.
  const referencia = calcular(casoBase());

  it('não muda nenhum número que já existia', () => {
    // Os indicadores antigos seguem idênticos; só há campos novos.
    // `ltcPico` é campo NOVO (migration 1763300000), como os cinco por-unidade.
    const {
      custoPorUnidade, custoPorSf, precoMedioPorUnidade, receitaPorSf, margemPorUnidade,
      ltcPico, custoTotalDividaPicoPct, ...antigos
    } = referencia.indicadores;
    expect(Object.keys(antigos)).toEqual([
      'moic', 'roi', 'margemVgv', 'ltc', 'alavancagem', 'custoTotalDividaPct',
      'tirMensal', 'tirAnual', 'xirr',
    ]);
    expect(ltcPico).not.toBeNull();
    expect(custoTotalDividaPicoPct).not.toBeNull();
    expect(custoPorUnidade).not.toBeNull();
    expect(precoMedioPorUnidade).not.toBeNull();
    expect(margemPorUnidade).not.toBeNull();
    // Sem área cadastrada, os dois por-sf são NULL — não NaN, não Infinity.
    expect(custoPorSf).toBeNull();
    expect(receitaPorSf).toBeNull();
  });

  it('custoPorUnidade × unidadesTotal reconstitui a apuração', () => {
    // A verificação do item, com tolerância de centavos.
    const { indicadores: ind, apuracao: ap, agregados: ag } = referencia;
    expect(ind.custoPorUnidade! * ag.unidadesTotal).toBeCloseTo(
      ap.custoEmpreendimento + ap.custoFinanceiro,
      2,
    );
    expect(ind.precoMedioPorUnidade! * ag.unidadesTotal).toBeCloseTo(ap.receitaBruta, 2);
    expect(ind.margemPorUnidade! * ag.unidadesTotal).toBeCloseTo(ap.lucroProjeto, 2);
  });

  it('por sf usa a área TOTAL: areaSf × quantidade', () => {
    const base = casoBase();
    // 1.800 sf por unidade em 4 unidades = 7.200 sf.
    base.unidades = base.unidades.map((u) => ({ ...u, areaSf: 1_800 }));
    const out = calcular(base);
    expect(out.agregados.areaTotalSf).toBe(7_200);
    expect(out.indicadores.custoPorSf! * 7_200).toBeCloseTo(
      out.apuracao.custoEmpreendimento + out.apuracao.custoFinanceiro,
      2,
    );
    expect(out.indicadores.receitaPorSf! * 7_200).toBeCloseTo(out.apuracao.receitaBruta, 2);
  });

  it('respeita a quantidade da tipologia na área total', () => {
    const base = casoBase();
    base.unidades = [
      { nome: 'A', quantidade: 45, custoTerreno: 0, custoObra: 0, precoVenda: 300_000, propertyTaxAno: 0, areaSf: 1_800 },
    ];
    const out = calcular(base);
    expect(out.agregados.areaTotalSf).toBe(81_000); // 45 × 1.800
    expect(out.indicadores.precoMedioPorUnidade).toBeCloseTo(300_000, 6);
  });

  it('denominador zero devolve null, nunca NaN nem Infinity', () => {
    const base = casoBase();
    base.unidades = [];
    const out = calcular(base);
    expect(out.agregados.unidadesTotal).toBe(0);
    for (const k of ['custoPorUnidade', 'custoPorSf', 'precoMedioPorUnidade', 'receitaPorSf', 'margemPorUnidade'] as const) {
      expect(out.indicadores[k]).toBeNull();
    }
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
  });
});

describe('23 — P&L por ano-calendário', () => {
  const referencia = calcular(casoBase());
  const anos = apuracaoAnual(referencia);

  it('abre um ano-calendário por ano tocado pelo cronograma', () => {
    // Caso base: mês 1 em dez/2025, 23 meses → dez/25, 2026 e 2027.
    expect(anos.map((a) => a.ano)).toEqual([2025, 2026, 2027]);
    expect(anos.map((a) => a.meses)).toEqual([1, 12, 10]);
    expect(soma(anos.map((a) => a.meses))).toBe(referencia.meses.length);
  });

  it('Σ resultado dos anos = lucroProjeto', () => {
    // A verificação do item, com tolerância de centavos.
    expect(soma(anos.map((a) => a.resultado))).toBeCloseTo(referencia.apuracao.lucroProjeto, 2);
    // E o acumulado da última coluna é o mesmo número.
    expect(anos[anos.length - 1].resultadoAcumulado).toBeCloseTo(referencia.apuracao.lucroProjeto, 2);
  });

  it('cada linha da demonstração fecha com a apuração do projeto', () => {
    const ap = referencia.apuracao;
    expect(soma(anos.map((a) => a.receitaBruta))).toBeCloseTo(ap.receitaBruta, 2);
    expect(soma(anos.map((a) => a.comissoes))).toBeCloseTo(ap.comissoes, 2);
    expect(soma(anos.map((a) => a.cartorio))).toBeCloseTo(ap.cartorio, 2);
    expect(soma(anos.map((a) => a.receitaLiquida))).toBeCloseTo(ap.receitaLiquida, 2);
    expect(soma(anos.map((a) => a.custoTerrenos))).toBeCloseTo(ap.custoTerrenos, 2);
    expect(soma(anos.map((a) => a.custoObra))).toBeCloseTo(ap.custoObra, 2);
    expect(soma(anos.map((a) => a.custoPropertyTax))).toBeCloseTo(ap.custoPropertyTax, 2);
    expect(soma(anos.map((a) => a.custoOutros))).toBeCloseTo(ap.custoOutros, 2);
    expect(soma(anos.map((a) => a.custoEmpreendimento))).toBeCloseTo(ap.custoEmpreendimento, 2);
    expect(soma(anos.map((a) => a.jurosTotais))).toBeCloseTo(ap.jurosTotais, 2);
    expect(soma(anos.map((a) => a.feeTotal))).toBeCloseTo(ap.feeTotal, 2);
  });

  it('comissão incide sobre a receita DO ANO, não sobre o VGV total', () => {
    // No caso base a venda é única, no mês 23 (ano 2027). Os anos sem venda têm
    // de sair com comissão ZERO — ratear o desconto do projeto pelos anos poria
    // comissão em ano sem venda nenhuma.
    expect(anos[0].receitaBruta).toBe(0);
    expect(anos[0].comissoes).toBe(0);
    expect(anos[0].cartorio).toBe(0);
    expect(anos[1].comissoes).toBe(0);
    // E o ano da venda concentra tudo.
    expect(anos[2].receitaBruta).toBeCloseTo(referencia.apuracao.receitaBruta, 2);
    expect(anos[2].comissoes).toBeCloseTo(referencia.apuracao.comissoes, 2);
    // A identidade da demonstração fecha dentro da coluna.
    for (const a of anos) {
      expect(a.receitaBruta - a.comissoes - a.cartorio).toBeCloseTo(a.receitaLiquida, 2);
      expect(a.receitaLiquida - a.custoEmpreendimento - a.custoFinanceiro).toBeCloseTo(a.resultado, 6);
    }
  });

  it('distribui a receita entre os anos quando há takedown', () => {
    const base = casoBase();
    base.unidades = [
      { nome: 'Casa', quantidade: 24, custoTerreno: 10_000, custoObra: 50_000, precoVenda: 500_000, propertyTaxAno: 0 },
    ];
    base.receita.modoVenda = 'takedown';
    // 2 unidades por mês do 12 ao 23 — cruza a virada de 2026 para 2027.
    base.receita.takedowns = Array.from({ length: 12 }, (_, k) => ({
      unidadeIndex: 0, faseIndex: null, ordem: k, mes: 12 + k, quantidade: 2, precoUnitario: 0,
    }));
    const out = calcular(base);
    const linhas = apuracaoAnual(out);
    // Agora dois anos têm receita, e cada um tem a SUA comissão.
    expect(linhas[1].receitaBruta).toBeGreaterThan(0);
    expect(linhas[2].receitaBruta).toBeGreaterThan(0);
    for (const a of linhas) {
      expect(a.comissoes).toBeCloseTo(a.receitaBruta * 0.06, 2);
      expect(a.cartorio).toBeCloseTo(a.receitaBruta * 0.02, 2);
    }
    expect(soma(linhas.map((a) => a.resultado))).toBeCloseTo(out.apuracao.lucroProjeto, 2);
  });

  it('segue o FLUXO quando um override afasta a receita do VGV', () => {
    // Deliberado: a demonstração mostra o que entrou, não o que o VGV prometia.
    // A divergência já tem conferência própria — `receita_lancada`.
    const base = casoBase();
    base.overrides = [{ mes: 23, linha: 'revenue', valor: 1_000_000 }];
    const out = calcular(base);
    const linhas = apuracaoAnual(out);
    expect(semaforo(out, 'receita_lancada')).toBe('ambar');
    expect(soma(linhas.map((a) => a.receitaLiquida))).toBeCloseTo(1_000_000, 2);
    // Σ dos anos = lucro do FLUXO, que difere do lucro apurado pelo VGV
    // exatamente na diferença que a conferência aponta.
    const lucroDoFluxo =
      1_000_000 - out.apuracao.custoEmpreendimento - out.apuracao.custoFinanceiro;
    expect(soma(linhas.map((a) => a.resultado))).toBeCloseTo(lucroDoFluxo, 2);
  });

  it('é puro: mesma entrada, mesma saída, sem mutar o ModelOutput', () => {
    const antes = JSON.stringify(referencia.meses);
    const a = apuracaoAnual(referencia);
    const b = apuracaoAnual(referencia);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(referencia.meses)).toBe(antes);
  });

  it('totalAnual soma as colunas sem conta própria', () => {
    const t = totalAnual(anos);
    expect(t.resultado).toBeCloseTo(referencia.apuracao.lucroProjeto, 2);
    expect(t.meses).toBe(referencia.meses.length);
    expect(t.receitaBruta).toBeCloseTo(referencia.apuracao.receitaBruta, 2);
    // Um total não tem acumulado próprio: repete o resultado.
    expect(t.resultadoAcumulado).toBe(t.resultado);
    expect(totalAnual([]).resultado).toBe(0);
  });

  it('projeto sem receita nenhuma não inventa comissão', () => {
    const base = casoBase();
    base.receita.modoVenda = 'manual';
    base.unidades = base.unidades.map((u) => ({ ...u, precoVenda: 0 }));
    const linhas = apuracaoAnual(calcular(base));
    expect(linhas.every((a) => a.receitaBruta === 0 && a.comissoes === 0)).toBe(true);
    expect(linhas.every((a) => Number.isFinite(a.resultado))).toBe(true);
  });
});

describe('24 — o que a linha do tempo desenha', () => {
  // A régua da aba Linha do tempo e a seção do PDF não têm conta própria: as duas
  // leem `cronograma`, `cronograma.fases` e os takedowns do input. Este bloco
  // cobra que essas fontes ficam coerentes nos dois extremos — projeto de frente
  // única e projeto faseado com takedowns —, que é o que garante que a régua não
  // quebra.
  it('com usaFases = false há cronograma global e NENHUMA fase para desenhar', () => {
    const out = calcular(casoBase());
    expect(out.cronograma.prazoTotal).toBe(23);
    expect(out.cronograma.mesInicioObra).toBe(11);
    expect(out.cronograma.mesFimObra).toBe(18);
    // A trilha de fases fica vazia — é por isso que a régua não quebra.
    expect(out.cronograma.fases).toEqual([]);
    // E os marcos do financiamento continuam dentro do prazo.
    expect(out.cronograma.mesSaida).toBeLessThanOrEqual(out.cronograma.prazoTotal);
  });

  it('as fases derivadas cabem na régua, todas dentro de 1..prazoTotal', () => {
    const base = casoBase();
    base.usaFases = true;
    base.fases = [
      { ordem: 0, nome: 'PH1', dataInicio: '2026-10-01', dataFim: '2027-01-31' },
      { ordem: 1, nome: 'PH2', dataInicio: '2027-02-01', dataFim: '2027-05-31' },
    ];
    base.alocacoes = [
      { unidadeIndex: 0, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 1, faseIndex: 0, quantidade: 1 },
      { unidadeIndex: 2, faseIndex: 1, quantidade: 1 },
      { unidadeIndex: 3, faseIndex: 1, quantidade: 1 },
    ];
    const out = calcular(base);
    expect(out.cronograma.fases).toHaveLength(2);
    for (const f of out.cronograma.fases) {
      expect(f.mesInicio).toBeGreaterThanOrEqual(1);
      expect(f.mesFim).toBeLessThanOrEqual(out.cronograma.prazoTotal);
      expect(f.nome).toBeTruthy();
    }
  });

  it('prazo zero não deixa a régua sem denominador', () => {
    // A tela mostra um aviso em vez de dividir por zero; aqui basta garantir que
    // o motor devolve prazo 0 sem estourar e sem mês nenhum.
    const base = casoBase();
    base.mesesAprovacao = 0;
    base.mesesConstrucao = 0;
    base.mesesPosObra = 0;
    const out = calcular(base);
    expect(out.cronograma.prazoTotal).toBe(0);
    expect(out.meses).toEqual([]);
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
    // E a demonstração anual de um projeto sem mês é uma lista vazia, não um erro.
    expect(apuracaoAnual(out)).toEqual([]);
    expect(totalAnual(apuracaoAnual(out)).resultado).toBe(0);
  });
});

describe('25 — detalhamento dos custos mês a mês', () => {
  // A garantia do item: o detalhamento tem de FECHAR com a linha do fluxo. Se
  // algum dia o lançamento ganhar uma regra que não passe por `lancar`, é aqui
  // que quebra — e não em silêncio, numa tela que soma errado.
  const fecha = (out: ReturnType<typeof calcular>) => {
    for (let m = 0; m < out.meses.length; m++) {
      const somaDetalhe = soma(out.detalhamentoCustos.map((d) => d.porMes[m]));
      expect(somaDetalhe).toBeCloseTo(out.meses[m].otherCosts, 6);
    }
  };

  it('para todo mês, Σ das linhas do detalhamento é o otherCosts do mês', () => {
    const out = calcular(casoBase());
    expect(out.detalhamentoCustos).toHaveLength(1);
    fecha(out);
  });

  it('fecha com gatilhos e bases misturados, que é onde o laço poderia divergir', () => {
    const base = casoBase();
    base.receita.modoVenda = 'per_unit';
    base.receita.vendasPorUnidade = [
      { unidadeIndex: 0, mesVenda: 19 },
      { unidadeIndex: 1, mesVenda: 20 },
      { unidadeIndex: 2, mesVenda: 21 },
      { unidadeIndex: 3, mesVenda: 22 },
    ];
    base.unidades = base.unidades.map((u) => ({ ...u, areaSf: 1_800 }));
    base.custosAdicionais = [
      custo({ label: 'Contingência', valor: 56_000, categoria: 'contingencia' }),
      custo({ label: 'Sitework', valor: 120_000, categoria: 'sitework', distribuicao: 'linear_total' }),
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra', parcelas: [] }),
      custo({ label: 'Habite-se', valor: 30_000, categoria: 'soft', gatilho: 'fim_obra', parcelas: [] }),
      custo({ label: 'Impact fee', categoria: 'soft', baseCalculo: 'por_unidade', valorUnitario: 5_200, gatilho: 'por_venda', parcelas: [] }),
      custo({ label: 'Marketing', categoria: 'soft', baseCalculo: 'por_sf', valorUnitario: 2, gatilho: 'mes_fixo', mesAncora: 15 }),
      custo({ label: 'Taxa do banco', categoria: 'financeiro', baseCalculo: 'pct_de_grupo', grupoReferencia: 'vertical', percentual: 0.01 }),
      // Mês âncora além do prazo: não lança, e o detalhamento fica todo em zero.
      custo({ label: 'Pós-obra', valor: 10_000, categoria: 'outros', gatilho: 'mes_fixo', mesAncora: 99 }),
    ];
    const out = calcular(base);
    fecha(out);
    expect(out.detalhamentoCustos).toHaveLength(8);
    // Ordem e endereço: o índice do detalhamento é o índice do input.
    expect(out.detalhamentoCustos.map((d) => d.label)).toEqual(
      base.custosAdicionais!.map((c) => c.label),
    );
    out.detalhamentoCustos.forEach((d, i) => {
      expect(d.indice).toBe(i);
      expect(d.porMes).toHaveLength(out.cronograma.prazoTotal);
      expect(soma(d.porMes)).toBeCloseTo(d.total, 6);
    });
    // O custo fora do prazo é guardado como zero, não some da lista.
    const fora = out.detalhamentoCustos[7];
    expect(fora.total).toBe(0);
    expect(fora.porMes.every((v) => v === 0)).toBe(true);
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBe('ambar');
  });

  it('o detalhamento é o AUTOMÁTICO: o override entra como diferença, não nele', () => {
    const base = casoBase();
    const comOverride: ModelInput = {
      ...base,
      overrides: [{ mes: 12, linha: 'other_costs', valor: 200_000 }],
    };
    const auto = calcular(base);
    const out = calcular(comOverride);
    // A linha do fluxo obedece ao override…
    expect(out.meses[11].otherCosts).toBeCloseTo(200_000, 2);
    // …e o detalhamento continua sendo o que o motor lançou.
    expect(JSON.stringify(out.detalhamentoCustos)).toBe(JSON.stringify(auto.detalhamentoCustos));
    // É esta diferença que a grade mostra como "Ajuste manual", e é ela que faz
    // pai = Σ filhas + ajuste em todo mês.
    const ajuste = out.meses.map(
      (m, i) => m.otherCosts - soma(out.detalhamentoCustos.map((d) => d.porMes[i])),
    );
    expect(ajuste[11]).toBeCloseTo(200_000 - auto.meses[11].otherCosts, 6);
    expect(soma(ajuste.filter((_, i) => i !== 11))).toBeCloseTo(0, 6);
  });

  it('lancadoPorCusto e o detalhamento contam a MESMA coisa', () => {
    // `total` não é somado de novo: é o próprio escalar que a conferência lê.
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra', parcelas: [] }),
      custo({ label: 'Fora do prazo', valor: 45_000, categoria: 'soft', gatilho: 'mes_fixo', mesAncora: 400 }),
    ];
    const out = calcular(base);
    expect(out.detalhamentoCustos[0].total).toBeCloseTo(90_000, 6);
    expect(out.detalhamentoCustos[1].total).toBe(0);
    // O que o gatilho não lançou continua aparecendo na conferência, com o valor
    // exato que ficou de fora.
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBe('ambar');
  });

  it('agruparCustosPorCategoria soma por categoria sem podar item nenhum', () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Contingência', valor: 56_000, categoria: 'contingencia' }),
      custo({ label: 'Alvará', valor: 90_000, categoria: 'soft', gatilho: 'inicio_obra', parcelas: [] }),
      custo({ label: 'Habite-se', valor: 30_000, categoria: 'soft', gatilho: 'fim_obra', parcelas: [] }),
      custo({ label: 'Nunca lançado', valor: 10_000, categoria: 'soft', gatilho: 'mes_fixo', mesAncora: 999 }),
    ];
    const out = calcular(base);
    const grupos = agruparCustosPorCategoria(out.detalhamentoCustos, out.cronograma.prazoTotal);
    // Ordem de CATEGORIAS_CUSTO: contingência vem antes de soft.
    expect(grupos.map((g) => g.categoria)).toEqual(['contingencia', 'soft']);
    expect(grupos[0].total).toBeCloseTo(56_000, 2);
    // O item que não lançou continua no grupo — quem decide escondê-lo é a tela.
    expect(grupos[1].itens).toHaveLength(3);
    expect(grupos[1].total).toBeCloseTo(120_000, 2);
    expect(grupos[1].porMes[10]).toBeCloseTo(90_000, 2);
    expect(grupos[1].porMes[17]).toBeCloseTo(30_000, 2);
    // E os grupos, somados, continuam fechando com a linha do fluxo.
    for (let m = 0; m < out.meses.length; m++) {
      expect(soma(grupos.map((g) => g.porMes[m]))).toBeCloseTo(out.meses[m].otherCosts, 6);
    }
  });

  it('sem custo adicional nenhum o detalhamento é lista vazia, não undefined', () => {
    const base = casoBase();
    base.custosAdicionais = [];
    const out = calcular(base);
    expect(out.detalhamentoCustos).toEqual([]);
    expect(agruparCustosPorCategoria(out.detalhamentoCustos, out.cronograma.prazoTotal)).toEqual([]);
    fecha(out);
  });
});

describe('26 — parcelamento do gatilho "mês fixo"', () => {
  // Teste de NÃO-REGRESSÃO da migration 1763000000.
  //
  // Nenhum custo já gravado tem parcela, e ZERO parcelas é exatamente o
  // comportamento anterior: 100% no mês âncora. O caminho novo é inalcançável
  // para toda modelagem que já existe, e é (a) que prova isso.
  const semParcelas = (): ModelInput => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({ label: 'Impact fee', valor: 56_000, categoria: 'soft', gatilho: 'mes_fixo', mesAncora: 12 }),
    ];
    return base;
  };
  const referencia = calcular(semParcelas());

  it('(a) custo mes_fixo sem parcelas lança 100% no mês âncora, como hoje', () => {
    const out = referencia;
    expect(out.meses[11].otherCosts).toBeCloseTo(56_000, 2);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(56_000, 2);
    // E nenhuma conferência nova aparece: as duas do parcelamento são
    // inalcançáveis sem parcela.
    expect(semaforo(out, 'custo_parcelas_vs_alvo')).toBeUndefined();
    expect(semaforo(out, 'custo_parcelas_fora_do_prazo')).toBeUndefined();
  });

  it('lista de parcelas vazia produz o ModelOutput idêntico ao de campo ausente', () => {
    const base = semParcelas();
    // O objeto exatamente como o mapeador o entregava ANTES desta migration.
    base.custosAdicionais = [
      { label: 'Impact fee', valor: 56_000, distribuicao: 'linear_construction', mesAncora: 12, categoria: 'soft', grupoPaiId: null, baseCalculo: 'total', valorUnitario: 0, grupoReferencia: null, percentual: 0, gatilho: 'mes_fixo' } as never,
    ];
    const out = calcular(base);
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(out.conferencias.map((c) => c.chave)).toEqual(
      referencia.conferencias.map((c) => c.chave),
    );
  });

  it('$56.000 em 4 parcelas gera 4 lançamentos somando exatamente $56.000', () => {
    const base = semParcelas();
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 12, valor: 14_000 },
      { ordem: 1, mes: 14, valor: 14_000 },
      { ordem: 2, mes: 16, valor: 14_000 },
      { ordem: 3, mes: 18, valor: 14_000 },
    ];
    const out = calcular(base);
    for (const m of [12, 14, 16, 18]) expect(out.meses[m - 1].otherCosts).toBeCloseTo(14_000, 2);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(56_000, 2);
    expect(soma(out.detalhamentoCustos[0].porMes)).toBeCloseTo(56_000, 2);
    // Fecha com o alvo → conferência verde.
    expect(semaforo(out, 'custo_parcelas_vs_alvo')).toBe('verde');
    expect(semaforo(out, 'custo_parcelas_fora_do_prazo')).toBe('verde');
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBeUndefined();
  });

  it('mexer numa parcela lança $50.000 — não $56.000 — e acende âmbar com -$6.000', () => {
    const base = semParcelas();
    // Partindo das 4 parcelas de $14.000 que fechavam o alvo, a última desce
    // para $8.000: a soma cai para $50.000 e a diferença é de -$6.000.
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 12, valor: 10_000 },
      { ordem: 1, mes: 14, valor: 14_000 },
      { ordem: 2, mes: 16, valor: 18_000 },
      { ordem: 3, mes: 18, valor: 8_000 },
    ];
    const out = calcular(base);
    expect(out.meses[11].otherCosts).toBeCloseTo(10_000, 2);
    // Quem manda no total lançado são as parcelas, não o valor do custo.
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(50_000, 2);
    const c = out.conferencias.find((x) => x.chave === 'custo_parcelas_vs_alvo');
    expect(c?.semaforo).toBe('ambar');
    expect(c?.valor).toContain('6,000');
    expect(c?.valor).toContain('-');
    // E não há conferência duplicada dizendo a mesma coisa por outro caminho.
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBeUndefined();
  });

  it('com parcelas, o mês âncora é ignorado — e continua guardado', () => {
    const base = semParcelas();
    base.custosAdicionais[0].mesAncora = 12;
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 20, valor: 28_000 },
      { ordem: 1, mes: 21, valor: 28_000 },
    ];
    const out = calcular(base);
    expect(out.meses[11].otherCosts).toBe(0);
    expect(out.meses[19].otherCosts).toBeCloseTo(28_000, 2);
    expect(out.meses[20].otherCosts).toBeCloseTo(28_000, 2);
    // O input do usuário não é apagado: removendo as parcelas, a âncora volta.
    base.custosAdicionais[0].parcelas = [];
    expect(calcular(base).meses[11].otherCosts).toBeCloseTo(56_000, 2);
  });

  it('parcela no mês 99 de um projeto de 23 meses não é lançada e acende as duas conferências', () => {
    const base = semParcelas();
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 12, valor: 28_000 },
      { ordem: 1, mes: 99, valor: 28_000 },
    ];
    const out = calcular(base);
    expect(out.cronograma.prazoTotal).toBe(23);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(28_000, 2);
    const fora = out.conferencias.find((x) => x.chave === 'custo_parcelas_fora_do_prazo');
    expect(fora?.semaforo).toBe('ambar');
    expect(fora?.valor).toBe('1');
    // O alvo das parcelas é $56.000 e só $28.000 entrou: o dinheiro que ficou de
    // fora aparece nomeado, em vez de sumir.
    expect(semaforo(out, 'custo_gatilho_nao_lancado')).toBe('ambar');
    // E as parcelas somam o valor do custo, então o alvo continua verde.
    expect(semaforo(out, 'custo_parcelas_vs_alvo')).toBe('verde');
  });

  it('duas parcelas no mesmo mês somam, não se sobrescrevem', () => {
    const base = semParcelas();
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 12, valor: 20_000 },
      { ordem: 1, mes: 12, valor: 36_000 },
    ];
    const out = calcular(base);
    expect(out.meses[11].otherCosts).toBeCloseTo(56_000, 2);
  });

  it('mês fracionário ou zero não é lançado nem cria buraco no fluxo', () => {
    const base = semParcelas();
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 12.5, valor: 28_000 },
      { ordem: 1, mes: 0, valor: 28_000 },
    ];
    const out = calcular(base);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBe(0);
    expect(out.meses.every((m) => Number.isFinite(m.otherCosts))).toBe(true);
    expect(semaforo(out, 'custo_parcelas_fora_do_prazo')).toBe('ambar');
  });

  it('base derivada: o alvo sai das unidades e as parcelas mandam no lançamento', () => {
    const base = semParcelas();
    // 4 unidades × $5.000 = $20.000 de alvo; as parcelas somam $18.000.
    base.custosAdicionais = [
      custo({
        label: 'Impact fee',
        categoria: 'soft',
        baseCalculo: 'por_unidade',
        valorUnitario: 5_000,
        gatilho: 'mes_fixo',
        mesAncora: 12,
        parcelas: [
          { ordem: 0, mes: 12, valor: 9_000 },
          { ordem: 1, mes: 15, valor: 9_000 },
        ],
      }),
    ];
    const out = calcular(base);
    expect(out.agregados.custosPorCategoria.soft).toBeCloseTo(20_000, 2);
    expect(soma(out.meses.map((m) => m.otherCosts))).toBeCloseTo(18_000, 2);
    const c = out.conferencias.find((x) => x.chave === 'custo_parcelas_vs_alvo');
    expect(c?.semaforo).toBe('ambar');
    expect(c?.detalhe).toContain('Impact fee');
  });

  it('parcela em custo com outro gatilho é ignorada, não lançada por acidente', () => {
    const base = casoBase();
    base.custosAdicionais = [
      custo({
        label: 'Contingência',
        valor: 56_000,
        categoria: 'outros',
        gatilho: 'cronograma',
        parcelas: [{ ordem: 0, mes: 3, valor: 999_999 }],
      }),
    ];
    const out = calcular(base);
    // Continua sendo a distribuição linear na obra do caso base.
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(calcular(casoBase()).meses));
    expect(semaforo(out, 'custo_parcelas_vs_alvo')).toBeUndefined();
  });

  it('o detalhamento mês a mês fecha também com parcelas', () => {
    const base = semParcelas();
    base.custosAdicionais[0].parcelas = [
      { ordem: 0, mes: 12, valor: 14_000 },
      { ordem: 1, mes: 14, valor: 14_000 },
      { ordem: 2, mes: 99, valor: 28_000 },
    ];
    const out = calcular(base);
    for (let m = 0; m < out.meses.length; m++) {
      expect(soma(out.detalhamentoCustos.map((d) => d.porMes[m]))).toBeCloseTo(
        out.meses[m].otherCosts,
        6,
      );
    }
  });

  it('as parcelas não bloqueiam o salvamento em nenhum cenário', () => {
    const base = semParcelas();
    base.custosAdicionais[0].parcelas = [{ ordem: 0, mes: 99, valor: 1 }];
    expect(bloqueiaSalvamento(calcular(base).conferencias)).toEqual([]);
  });
});

describe('27 — mapeamento das parcelas de custo', () => {
  it('DECIMAL como string vira número, e o sub-select nulo vira lista vazia', () => {
    const custos = mapearCustos([
      {
        id: 7,
        label: 'Impact fee',
        valor: '56000.00',
        gatilho: 'mes_fixo',
        mes_ancora: '12',
        categoria: 'soft',
        base_calculo: 'total',
        parcelas: [
          { id: 3, ordem: '1', mes: '14', valor: '14000.00' },
          { id: 2, ordem: '0', mes: '12', valor: '14000.00' },
        ],
      },
      // Linha gravada antes da migration: sem a chave `parcelas`.
      { id: 8, label: 'Alvará', valor: '9000.00', gatilho: 'mes_fixo', mes_ancora: '11' },
    ]);
    expect(custos[0].parcelas).toEqual([
      { id: 2, ordem: 0, mes: 12, valor: 14_000 },
      { id: 3, ordem: 1, mes: 14, valor: 14_000 },
    ]);
    // Somar as parcelas mapeadas dá número, não texto concatenado.
    expect(custos[0].parcelas.reduce((a, p) => a + p.valor, 0)).toBe(28_000);
    expect(custos[1].parcelas).toEqual([]);
  });

  it('mês nulo ou zero vira 1 em vez de sumir, e o valor ausente vira zero', () => {
    const [c] = mapearCustos([
      { id: 1, label: 'X', gatilho: 'mes_fixo', parcelas: [{ id: 9, mes: null, valor: null }] },
    ]);
    expect(c.parcelas).toEqual([{ id: 9, ordem: 0, mes: 1, valor: 0 }]);
  });
});

describe('28 — capital por sócio: rateio, devolução e indicadores individuais', () => {
  // Teste de NÃO-REGRESSÃO da migration 1763100000.
  //
  // 'participacao' é o default e o estado de toda modelagem já gravada: a fração
  // de capital É a participação, e o rateio volta a ser o pro-rata de sempre.
  const socio = (nome: string, p: number, extra: Partial<Socio> = {}): Socio => ({
    nome,
    participacaoPct: p,
    cotaDisponivel: false,
    aportes: [],
    ...extra,
  });

  const comRegra = (
    regra: RegraRateioCapital,
    socios: Socio[],
  ): ModelInput => {
    const base = casoBase();
    base.socios = socios;
    base.aportes = { ...base.aportes!, regraRateioCapital: regra };
    return base;
  };

  const referencia = calcular(casoBase());

  it('(a) regra "participacao" sem pctCapital reproduz o rateio de sempre', () => {
    const out = calcular(comRegra('participacao', [socio('S1', 0.5), socio('S2', 0.5)]));
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(out.indicadores)).toBe(JSON.stringify(referencia.indicadores));
    expect(out.fluxoInvestidor).toEqual(referencia.fluxoInvestidor);
    // E o rateio antigo, campo a campo: capital, lucro, total e chamadasPorMes.
    out.rateioSocios.forEach((r, i) => {
      const p = 0.5;
      expect(r.pctCapital).toBeCloseTo(p, 10);
      expect(r.capital).toBeCloseTo(p * out.apuracao.equityTotal, 6);
      expect(r.lucro).toBeCloseTo(p * out.apuracao.lucroInvestidores, 6);
      expect(r.total).toBeCloseTo(p * out.apuracao.totalDistribuido, 6);
      expect(r.chamadasPorMes).toEqual(out.meses.map((m) => p * m.equityCall));
      expect(JSON.stringify(r.chamadasPorMes)).toBe(
        JSON.stringify(referencia.rateioSocios[i].chamadasPorMes),
      );
    });
  });

  it('regra ausente cai em "participacao", como a modelagem nunca migrada', () => {
    const base = casoBase();
    // Exatamente o objeto que o mapeador entregava ANTES desta migration.
    base.aportes = { modoAporte: 'demanda', aporteBaseTotal: 732_778, valorTotalAlvo: 0 } as never;
    const out = calcular(base);
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.rateioSocios)).toBe(JSON.stringify(referencia.rateioSocios));
  });

  // ─── Identidade 1: o capital não aparece nem some entre projeto e sócios ───
  const fechaChamadas = (out: ReturnType<typeof calcular>) => {
    for (let k = 0; k < out.meses.length; k++) {
      const somaChamadas = soma(out.rateioSocios.map((r) => r.chamadasPorMes[k]));
      expect(somaChamadas).toBeCloseTo(out.meses[k].equityCall, 6);
    }
  };
  /** Identidade forte: vale SEMPRE, inclusive com override em distribution. */
  const fechaDevolucoes = (out: ReturnType<typeof calcular>) => {
    for (let k = 0; k < out.meses.length; k++) {
      const somaDev = soma(out.rateioSocios.map((r) => r.devolucoesPorMes[k]));
      expect(somaDev).toBeCloseTo(out.meses[k].distribution, 6);
    }
  };
  /**
   * Identidade contra a APURAÇÃO. Vale quando a distribuição é a automática —
   * que é todo caso sem override em `distribution` e com o mês de saída dentro
   * do prazo. Com override, o fluxo distribui um valor que a apuração não
   * conhece, e é o FLUXO que manda: `total` é o que o sócio recebeu de fato.
   */
  const fechaTotalDistribuido = (out: ReturnType<typeof calcular>) =>
    expect(soma(out.rateioSocios.map((r) => r.total))).toBeCloseTo(
      out.apuracao.totalDistribuido,
      6,
    );

  it('Σ chamadas = equityCall e Σ devoluções = distribution nas TRÊS regras', () => {
    const porParticipacao = calcular(comRegra('participacao', [socio('S1', 0.6), socio('S2', 0.4)]));
    fechaChamadas(porParticipacao);
    fechaDevolucoes(porParticipacao);
    fechaTotalDistribuido(porParticipacao);

    const porCapital = calcular(
      comRegra('pct_capital', [
        socio('S1', 0.5, { pctCapital: 0.7 }),
        socio('S2', 0.5, { pctCapital: 0.3 }),
      ]),
    );
    fechaChamadas(porCapital);
    fechaDevolucoes(porCapital);
    fechaTotalDistribuido(porCapital);

    const porCronograma = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 300_000 }, { ordem: 1, mes: 8, valor: 120_000 }] }),
        socio('S2', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 300_000 }, { ordem: 1, mes: 12, valor: 120_000 }] }),
      ]),
    );
    fechaChamadas(porCronograma);
    fechaDevolucoes(porCronograma);
    fechaTotalDistribuido(porCronograma);
  });

  it('pct_capital: 70/30 do capital com 50/50 de lucro', () => {
    const out = calcular(
      comRegra('pct_capital', [
        socio('S1', 0.5, { pctCapital: 0.7 }),
        socio('S2', 0.5, { pctCapital: 0.3 }),
      ]),
    );
    const [a, b] = out.rateioSocios;
    expect(a.pctCapital).toBeCloseTo(0.7, 10);
    expect(a.capital).toBeCloseTo(0.7 * out.apuracao.equityTotal, 6);
    expect(b.capital).toBeCloseTo(0.3 * out.apuracao.equityTotal, 6);
    // O LUCRO continua saindo da participação, não do capital.
    expect(a.lucro).toBeCloseTo(0.5 * out.apuracao.lucroInvestidores, 6);
    expect(b.lucro).toBeCloseTo(0.5 * out.apuracao.lucroInvestidores, 6);
    // Quem põe mais capital e recebe o mesmo lucro tem retorno MENOR.
    expect(a.moic!).toBeLessThan(b.moic!);
    expect(a.roi!).toBeLessThan(b.roi!);
    expect(semaforo(out, 'capital_vs_participacao')).toBe('ambar');
    expect(semaforo(out, 'soma_pct_capital')).toBe('verde');
  });

  it('pctCapital nulo herda a participação; zero é "não põe capital"', () => {
    const out = calcular(
      comRegra('pct_capital', [
        socio('S1', 0.5, { pctCapital: null }),
        socio('S2', 0.5, { pctCapital: null }),
      ]),
    );
    // Herdando, a regra vira a de participação — e o rateio é o de sempre.
    expect(JSON.stringify(out.rateioSocios.map((r) => r.chamadasPorMes))).toBe(
      JSON.stringify(referencia.rateioSocios.map((r) => r.chamadasPorMes)),
    );
    expect(semaforo(out, 'capital_vs_participacao')).toBe('verde');
    // E na regra 'participacao' a conferência nem existe: seria verde por
    // construção, e apareceria como item novo no painel de toda modelagem salva.
    expect(semaforo(referencia, 'capital_vs_participacao')).toBeUndefined();

    const semCapital = calcular(
      comRegra('pct_capital', [
        socio('S1', 0.5, { pctCapital: 1 }),
        socio('S2', 0.5, { pctCapital: 0 }),
      ]),
    );
    const b = semCapital.rateioSocios[1];
    expect(b.capital).toBe(0);
    // Capital zero: null em tudo, nunca Infinity nem NaN.
    expect(b.moic).toBeNull();
    expect(b.roi).toBeNull();
    expect(b.tirMensal).toBeNull();
    expect(b.tirAnual).toBeNull();
    expect(b.xirr).toBeNull();
    // Mas ele continua recebendo lucro pela participação: o total NÃO é zero.
    expect(b.total).toBeGreaterThan(0);
  });

  it('50/50 com pct_capital 50/50: TIR de cada sócio é a TIR geral', () => {
    const out = calcular(
      comRegra('pct_capital', [
        socio('S1', 0.5, { pctCapital: 0.5 }),
        socio('S2', 0.5, { pctCapital: 0.5 }),
      ]),
    );
    for (const r of out.rateioSocios) {
      expect(r.tirMensal!).toBeCloseTo(out.indicadores.tirMensal!, 8);
      expect(r.tirAnual!).toBeCloseTo(out.indicadores.tirAnual!, 8);
      expect(r.moic!).toBeCloseTo(out.indicadores.moic!, 8);
      // O fluxo dele é o fluxo do investidor em escala.
      r.fluxoPorMes.forEach((v, k) => expect(v).toBeCloseTo(0.5 * out.fluxoInvestidor[k], 6));
    }
  });

  it('mesmo valor em meses diferentes: quem aporta DEPOIS tem TIR maior', () => {
    // A verificação que separa este item de um rateio pro-rata disfarçado: com a
    // fração de capital idêntica, só a DATA muda — e a TIR precisa reagir a ela.
    const out = calcular(
      comRegra('cronograma_socio', [
        socio('Cedo', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 400_000 }] }),
        socio('Tarde', 0.5, { aportes: [{ ordem: 0, mes: 6, valor: 400_000 }] }),
      ]),
    );
    const [cedo, tarde] = out.rateioSocios;
    // Mesmo capital e mesma devolução: a única diferença é o mês.
    expect(cedo.capital).toBeCloseTo(tarde.capital, 6);
    expect(cedo.total).toBeCloseTo(tarde.total, 6);
    expect(cedo.moic!).toBeCloseTo(tarde.moic!, 8);
    // …e ainda assim as TIRs divergem, porque o dinheiro ficou parado mais tempo.
    expect(tarde.tirMensal!).toBeGreaterThan(cedo.tirMensal!);
    expect(tarde.xirr!).toBeGreaterThan(cedo.xirr!);
    // E as duas divergem da TIR geral, que trata o projeto como um sócio só.
    expect(cedo.tirMensal).not.toBeCloseTo(out.indicadores.tirMensal!, 6);
    expect(tarde.tirMensal).not.toBeCloseTo(out.indicadores.tirMensal!, 6);
    fechaChamadas(out);
    fechaDevolucoes(out);
    fechaTotalDistribuido(out);
  });

  it('cronograma_socio: o equityCall do mês é a SOMA dos aportes daquele mês', () => {
    const out = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 0.5, { aportes: [{ ordem: 0, mes: 2, valor: 250_000 }] }),
        socio('S2', 0.5, { aportes: [{ ordem: 0, mes: 2, valor: 150_000 }, { ordem: 1, mes: 9, valor: 100_000 }] }),
      ]),
    );
    expect(out.meses[1].equityCall).toBeCloseTo(400_000, 6);
    expect(out.meses[8].equityCall).toBeCloseTo(100_000, 6);
    expect(out.meses[0].equityCall).toBe(0);
    expect(out.apuracao.equityTotal).toBeCloseTo(500_000, 6);
    // A fração de capital é DERIVADA do que cada um pôs.
    expect(out.rateioSocios[0].pctCapital).toBeCloseTo(250_000 / 500_000, 8);
    expect(out.rateioSocios[1].pctCapital).toBeCloseTo(250_000 / 500_000, 8);
  });

  it('dois aportes do mesmo sócio no mesmo mês somam, não se sobrescrevem', () => {
    const out = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 1, {
          aportes: [
            { ordem: 0, mes: 3, valor: 200_000 },
            { ordem: 1, mes: 3, valor: 300_000 },
          ],
        }),
      ]),
    );
    expect(out.meses[2].equityCall).toBeCloseTo(500_000, 6);
    expect(out.rateioSocios[0].chamadasPorMes[2]).toBeCloseTo(500_000, 6);
  });

  it('aporte no mês 99 de um projeto de 23 meses não é lançado e acende a conferência', () => {
    const out = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 400_000 }, { ordem: 1, mes: 99, valor: 400_000 }] }),
        socio('S2', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 400_000 }] }),
      ]),
    );
    expect(out.cronograma.prazoTotal).toBe(23);
    expect(out.apuracao.equityTotal).toBeCloseTo(800_000, 6);
    const fora = out.conferencias.find((c) => c.chave === 'aportes_socio_fora_do_prazo');
    expect(fora?.semaforo).toBe('ambar');
    expect(fora?.valor).toBe('1');
    // Mês fracionário e mês zero também ficam de fora, sem contaminar o fluxo.
    const estranho = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 1, { aportes: [{ ordem: 0, mes: 5.5, valor: 100 }, { ordem: 1, mes: 0, valor: 100 }] }),
      ]),
    );
    expect(estranho.apuracao.equityTotal).toBe(0);
    expect(estranho.meses.every((m) => Number.isFinite(m.equityCall))).toBe(true);
  });

  it('cronograma_socio ignora o override de equity_call — e é a única exceção', () => {
    const base = comRegra('cronograma_socio', [
      socio('S1', 1, { aportes: [{ ordem: 0, mes: 1, valor: 500_000 }] }),
    ]);
    const semOverride = calcular(base);
    const comOverride = calcular({
      ...base,
      overrides: [{ mes: 1, linha: 'equity_call', valor: 9_999_999 }],
    });
    // O override NÃO entra: o motor não teria a quem atribuir o valor, e a
    // identidade Σ chamadas = equityCall quebraria.
    expect(comOverride.meses[0].equityCall).toBeCloseTo(500_000, 6);
    expect(JSON.stringify(comOverride.meses)).toBe(JSON.stringify(semOverride.meses));
    fechaChamadas(comOverride);
    // Nas outras regras o override continua vencendo, como sempre.
    const porParticipacao = calcular({
      ...comRegra('participacao', [socio('S1', 1)]),
      overrides: [{ mes: 1, linha: 'equity_call', valor: 9_999_999 }],
    });
    expect(porParticipacao.meses[0].equityCall).toBeCloseTo(9_999_999, 6);
  });

  it('a devolução é capital primeiro, lucro depois — e não um waterfall', () => {
    const out = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 600_000 }] }),
        socio('S2', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 200_000 }] }),
      ]),
    );
    const [a, b] = out.rateioSocios;
    const mesSaida = out.cronograma.mesSaida - 1;
    // Camada 1: cada um recupera exatamente o que pôs.
    // Camada 2: o que sobra vai por PARTICIPAÇÃO, meio a meio.
    const lucroCadaUm = 0.5 * out.apuracao.lucroInvestidores;
    expect(a.total).toBeCloseTo(600_000 + lucroCadaUm, 4);
    expect(b.total).toBeCloseTo(200_000 + lucroCadaUm, 4);
    expect(a.lucro).toBeCloseTo(lucroCadaUm, 4);
    expect(b.lucro).toBeCloseTo(lucroCadaUm, 4);
    // Tudo acontece no mês da saída, que é onde a distribuição é lançada.
    expect(a.devolucoesPorMes[mesSaida]).toBeCloseTo(a.total, 4);
    // Quem pôs menos capital para o mesmo lucro tem MOIC e ROI maiores.
    expect(b.moic!).toBeGreaterThan(a.moic!);
    expect(b.roi!).toBeGreaterThan(a.roi!);
  });

  it('sócio que entra depois da distribuição não é reembolsado antes de aportar', () => {
    // A camada de capital olha o saldo NAQUELE mês, não o capital do projeto
    // inteiro: ninguém recebe de volta um dinheiro que ainda não pôs.
    const base = comRegra('cronograma_socio', [
      socio('S1', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 500_000 }] }),
      socio('S2', 0.5, { aportes: [{ ordem: 0, mes: 20, valor: 500_000 }] }),
    ]);
    base.overrides = [{ mes: 10, linha: 'distribution', valor: 200_000 }];
    const out = calcular(base);
    // No mês 10 só S1 tem capital em risco: a devolução é toda dele.
    expect(out.rateioSocios[0].devolucoesPorMes[9]).toBeCloseTo(200_000, 4);
    expect(out.rateioSocios[1].devolucoesPorMes[9]).toBe(0);
    // A identidade por MÊS vale mesmo aqui. A identidade contra a apuração não:
    // o override distribuiu $200.000 que `totalDistribuido` não conhece, e é o
    // fluxo que manda no que o sócio recebeu.
    fechaDevolucoes(out);
    expect(soma(out.rateioSocios.map((r) => r.total))).toBeCloseTo(
      out.apuracao.totalDistribuido + 200_000,
      4,
    );
  });

  it('sem sócio nenhum o rateio é lista vazia, e nada estoura', () => {
    const out = calcular(comRegra('participacao', []));
    expect(out.rateioSocios).toEqual([]);
    expect(Number.isFinite(out.apuracao.lucroProjeto)).toBe(true);
    expect(semaforo(out, 'soma_participacoes')).toBe('ambar');
  });

  it('pct_capital que não soma 100% é vermelho e BLOQUEIA o salvamento', () => {
    const out = calcular(
      comRegra('pct_capital', [
        socio('S1', 0.5, { pctCapital: 0.5 }),
        socio('S2', 0.5, { pctCapital: 0.3 }),
      ]),
    );
    expect(semaforo(out, 'soma_pct_capital')).toBe('vermelho');
    expect(bloqueiaSalvamento(out.conferencias).map((c) => c.chave)).toContain('soma_pct_capital');
    // E na regra 'participacao' a conferência nem existe — nenhuma modelagem já
    // gravada passa a ser bloqueada por ela.
    expect(semaforo(referencia, 'soma_pct_capital')).toBeUndefined();
    expect(bloqueiaSalvamento(referencia.conferencias)).toEqual([]);
  });

  it('sócio sem aporte no cronograma acende âmbar em vez de sumir', () => {
    const out = calcular(
      comRegra('cronograma_socio', [
        socio('S1', 0.5, { aportes: [{ ordem: 0, mes: 1, valor: 800_000 }] }),
        socio('S2', 0.5),
      ]),
    );
    const c = out.conferencias.find((x) => x.chave === 'socio_sem_aporte');
    expect(c?.semaforo).toBe('ambar');
    expect(c?.detalhe).toContain('S2');
    expect(out.rateioSocios[1].capital).toBe(0);
    expect(out.rateioSocios[1].moic).toBeNull();
  });

  it('cronograma que não cobre a demanda deixa o caixa negativo e é acusado', () => {
    const out = calcular(
      comRegra('cronograma_socio', [socio('S1', 1, { aportes: [{ ordem: 0, mes: 1, valor: 1_000 }] })]),
    );
    const c = out.conferencias.find((x) => x.chave === 'caixa_minimo');
    expect(c?.semaforo).toBe('vermelho');
    expect(c?.detalhe).toContain('cronograma por sócio');
    // Não há uma SEGUNDA conferência dizendo a mesma coisa.
    expect(semaforo(out, 'aportes_socio_vs_demanda')).toBeUndefined();
  });

  it('a célula de aporte do fluxo fica somente leitura no cronograma por sócio', () => {
    const porSocio = comRegra('cronograma_socio', [socio('S1', 1)]);
    expect(editaPlanoDeAportes(porSocio, 'equity_call')).toBe(false);
    expect(aporteSomenteLeitura(porSocio, 'equity_call')).toBe(true);
    // Nas demais regras nada muda: com o plano ligado a célula edita a parcela.
    const comPlano = comRegra('participacao', [socio('S1', 1)]);
    comPlano.aportes = { ...comPlano.aportes!, modoAporte: 'plano' };
    expect(editaPlanoDeAportes(comPlano, 'equity_call')).toBe(true);
    expect(aporteSomenteLeitura(comPlano, 'equity_call')).toBe(false);
    expect(aporteSomenteLeitura(porSocio, 'revenue')).toBe(false);
  });
});

describe('29 — mapeamento do capital por sócio', () => {
  it('DECIMAL como string vira número e o sub-select nulo vira lista vazia', () => {
    const socios = mapearSocios([
      {
        id: 4,
        nome: 'S1',
        participacao_pct: '0.500000',
        pct_capital: '0.700000',
        aportes: [
          { id: 9, ordem: '1', mes: '6', valor: '150000.00' },
          { id: 8, ordem: '0', mes: '1', valor: '250000.00' },
        ],
      },
      // Linha gravada antes da migration: sem `pct_capital` e sem `aportes`.
      { id: 5, nome: 'S2', participacao_pct: '0.500000' },
    ]);
    expect(socios[0].pctCapital).toBe(0.7);
    expect(socios[0].aportes).toEqual([
      { id: 8, ordem: 0, mes: 1, valor: 250_000, observacao: null },
      { id: 9, ordem: 1, mes: 6, valor: 150_000, observacao: null },
    ]);
    // Somar os aportes mapeados dá número, não texto concatenado.
    expect(socios[0].aportes.reduce((a, p) => a + p.valor, 0)).toBe(400_000);
    // `null` sobrevive: é "usa a participação", diferente de "capital zero".
    expect(socios[1].pctCapital).toBeNull();
    expect(socios[1].aportes).toEqual([]);
  });

  it('pct_capital zero NÃO vira null — zero é uma escolha do usuário', () => {
    const [s] = mapearSocios([{ id: 1, nome: 'X', participacao_pct: '0.5', pct_capital: '0.000000' }]);
    expect(s.pctCapital).toBe(0);
  });

  it('regra ausente ou desconhecida cai em "participacao"', () => {
    expect(mapearAportes({}).regraRateioCapital).toBe('participacao');
    expect(mapearAportes({ regra_rateio_capital: 'xpto' }).regraRateioCapital).toBe('participacao');
    expect(mapearAportes({ regra_rateio_capital: 'pct_capital' }).regraRateioCapital).toBe(
      'pct_capital',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modo de saque 'equity_first_demanda' (migration 1763200000)
//
// O que o modo resolve: no 'equity_first' o saque não passa da OBRA do mês, e
// terreno, property tax, custos do orçamento e custo financeiro ficam sem
// cobertura — com aporte por PLANO (que não é resíduo de caixa) o caixa fica
// negativo. Aqui o saque cobre a demanda do mês descontado o aporte do próprio
// mês, e o caixa fecha no colchão.
// ─────────────────────────────────────────────────────────────────────────────
describe('modo de saque equity_first_demanda', () => {
  const COLCHAO = 50_000;

  /** Caso base com janela de saque no projeto inteiro e aporte por plano. */
  const casoDemanda = (patch: Partial<ModelInput> = {}): ModelInput => {
    const b = casoBase();
    return {
      ...b,
      aportes: {
        modoAporte: 'plano',
        aporteBaseTotal: 732_778,
        valorTotalAlvo: 0,
        regraRateioCapital: 'participacao' as const,
        parcelas: [{ mes: 1, valor: 300_000 }],
      },
      financiamento: {
        ...b.financiamento,
        modoSaque: 'equity_first_demanda',
        custoFinanceiroNaDemanda: true,
        colchaoMinimoCaixa: COLCHAO,
        mesInicioSaque: 1,
        mesFimSaque: 23,
      },
      ...patch,
    };
  };

  it('com teto folgado, o caixa fecha EXATAMENTE no colchão em todo mês deficitário', () => {
    const out = calcular(casoDemanda());
    for (const m of out.meses) {
      // Nunca abaixo do colchão: é o que o modo existe para garantir.
      expect(m.caixaAcumulado).toBeGreaterThan(COLCHAO - DOLAR);
      // E nunca ACIMA dele por saque a mais: mês com demanda fecha no colchão,
      // sem dinheiro parado pagando juros. Mês superavitário (aporte do plano,
      // receita da venda) fecha acima, e isso é o caixa do projeto, não saque.
      if (m.demandaDimensionada > DOLAR) {
        expect(m.caixaAcumulado).toBeCloseTo(COLCHAO, 0);
      }
    }
    expect(semaforo(out, 'caixa_minimo')).toBe('verde');
    expect(semaforo(out, 'teto_divida')).toBe('ambar'); // sem teto declarado
    expect(out.convergiu).toBe(true);
  });

  it('não saca no mês 1 quando o aporte do mês já cobre tudo — o cash_demand saca', () => {
    const novo = calcular(casoDemanda());
    expect(novo.meses[0].draw).toBe(0);
    expect(novo.meses[0].demandaDimensionada).toBe(0);

    // Mesmo input, só trocando o modo: o cash_demand ignora o aporte do próprio
    // mês e saca dinheiro que fica parado em caixa pagando juros.
    const base = casoDemanda();
    const antigo = calcular({
      ...base,
      financiamento: { ...base.financiamento, modoSaque: 'cash_demand' },
    });
    expect(antigo.meses[0].draw).toBeGreaterThan(0);
    expect(novo.apuracao.custoFinanceiro).toBeLessThan(antigo.apuracao.custoFinanceiro);
  });

  it('desconta o aporte previsto do mês em cada uma das origens do plano', () => {
    const semParcela = calcular(casoDemanda());
    const demanda14 = semParcela.meses[13].demandaDimensionada;
    expect(demanda14).toBeGreaterThan(0);

    // Plano: uma parcela que cobre a demanda do mês 14 zera o saque do mês 14.
    // Não se compara o saque com "o de antes menos a parcela": o aporte muda a
    // dívida, e a dívida muda os juros dos meses seguintes.
    const comParcela = calcular(
      casoDemanda({
        aportes: {
          modoAporte: 'plano',
          aporteBaseTotal: 0,
          valorTotalAlvo: 0,
          regraRateioCapital: 'participacao' as const,
          parcelas: [{ mes: 1, valor: 300_000 }, { mes: 14, valor: demanda14 + 10_000 }],
        },
      }),
    );
    expect(comParcela.meses[13].draw).toBe(0);
    // E uma parcela PARCIAL abate quase exatamente o que aporta — a diferença é
    // só o custo financeiro que ela mesma evitou.
    const metade = calcular(
      casoDemanda({
        aportes: {
          modoAporte: 'plano',
          aporteBaseTotal: 0,
          valorTotalAlvo: 0,
          regraRateioCapital: 'participacao' as const,
          parcelas: [{ mes: 1, valor: 300_000 }, { mes: 14, valor: demanda14 / 2 }],
        },
      }),
    );
    expect(metade.meses[13].draw).toBeCloseTo(demanda14 / 2, -4);

    // Cronograma por sócio: a soma dos aportes do mês faz o mesmo papel.
    const base = casoDemanda();
    const porSocio = calcular({
      ...base,
      aportes: {
        modoAporte: 'demanda',
        aporteBaseTotal: 0,
        valorTotalAlvo: 0,
        regraRateioCapital: 'cronograma_socio' as const,
      },
      socios: [
        { nome: 'S1', participacaoPct: 0.5, cotaDisponivel: false, aportes: [{ ordem: 0, mes: 1, valor: 300_000 }] },
        { nome: 'S2', participacaoPct: 0.5, cotaDisponivel: false, aportes: [{ ordem: 0, mes: 1, valor: 200_000 }] },
      ],
    });
    // Mês 1: 500.000 de aporte contra 240.000 de terreno — nada a sacar.
    expect(porSocio.meses[0].draw).toBe(0);

    // Override de equity_call: entra no desconto como qualquer aporte previsto,
    // porque é o que o passo 5 vai lançar.
    const comOverride = calcular({
      ...base,
      overrides: [{ mes: 14, linha: 'equity_call', valor: 150_000 }],
    });
    // Mesmo abatimento da parcela do plano, a menos do custo financeiro que o
    // próprio aporte evita nos meses seguintes.
    expect(comOverride.meses[13].draw).toBeCloseTo(demanda14 - 150_000, -4);
    expect(comOverride.meses[13].equityCall).toBe(150_000);
  });

  it('no modo de aporte "demanda" o saque cobre tudo e o aporte residual fica zero', () => {
    const base = casoDemanda();
    const out = calcular({
      ...base,
      aportes: {
        modoAporte: 'demanda',
        aporteBaseTotal: 732_778,
        valorTotalAlvo: 0,
        regraRateioCapital: 'participacao' as const,
      },
    });
    // Sem laço infinito e sem oscilação: o ponto fixo fecha, e bem antes do
    // limite de 50 passadas. Custa mais passadas que o equity_first (3) porque o
    // saque realimenta o custo financeiro, como no cash_demand.
    expect(out.convergiu).toBe(true);
    expect(out.iteracoes).toBeLessThanOrEqual(15);
    // aportePrevisto é ZERO nesse modo (o aporte é resíduo do caixa), então o
    // saque cobre a demanda inteira e não sobra resíduo nenhum para o equity.
    for (const m of out.meses) expect(m.equityCall).toBeCloseTo(0, 0);
    expect(out.apuracao.equityTotal).toBeCloseTo(0, 0);
  });

  it('fora da janela de saque o buraco fica — janela é contrato', () => {
    const base = casoDemanda();
    const out = calcular({
      ...base,
      financiamento: { ...base.financiamento, mesInicioSaque: 13, mesFimSaque: 23 },
    });
    // Obra começa no mês 11, saque só no 13: os meses 11 e 12 ficam descobertos.
    expect(out.meses[10].draw).toBe(0);
    expect(out.meses[10].demandaDescoberta).toBeGreaterThan(0);
    expect(semaforo(out, 'caixa_minimo')).toBe('vermelho');
  });

  it('teto que binda acende teto_divida em vermelho e diz quanto de aporte falta', () => {
    const base = casoDemanda();
    // Teto apertado: 20% do custo direto de 1.580.000 = 316.000.
    const out = calcular({
      ...base,
      financiamento: { ...base.financiamento, maxLtcPct: 0.2 },
    });
    const conf = out.conferencias.find((c) => c.chave === 'teto_divida')!;
    expect(conf.semaforo).toBe('vermelho');
    expect(conf.detalhe).toMatch(/O saque bateu no teto em \d+ (mês|meses)\./);
    expect(conf.detalhe).toMatch(/Faltaram \$[\d.,]+ de cobertura/);
    expect(conf.detalhe).toMatch(/elevar o teto de dívida para [\d.,]+% do custo direto/);
    // O saque respeita o teto, e o que ele cortou vira caixa descoberto.
    expect(out.apuracao.dividaSacada).toBeLessThan(out.apuracao.tetoDivida + DOLAR);
    expect(semaforo(out, 'caixa_minimo')).toBe('vermelho');

    // Sem teto que binde, a mesma conferência não fala em corte nenhum.
    const folgado = calcular(base);
    expect(
      folgado.conferencias.find((c) => c.chave === 'teto_divida')!.detalhe,
    ).not.toMatch(/bateu no teto/);
  });

  it('custo_financeiro_fora_da_demanda só existe no modo novo com a flag desligada', () => {
    const base = casoDemanda();
    const chave = 'custo_financeiro_fora_da_demanda';
    const desligada = calcular({
      ...base,
      financiamento: { ...base.financiamento, custoFinanceiroNaDemanda: false },
    });
    const conf = desligada.conferencias.find((c) => c.chave === chave)!;
    expect(conf.semaforo).toBe('ambar');
    expect(conf.detalhe).toContain('o caixa não fecha no colchão');
    // E o caixa realmente não fecha no colchão: os juros saem sem cobertura.
    expect(Math.min(...desligada.meses.map((m) => m.caixaAcumulado))).toBeLessThan(COLCHAO - DOLAR);

    // Com a flag ligada, e em qualquer outro modo, a conferência NEM APARECE —
    // o painel de toda modelagem já gravada continua com as de sempre.
    expect(calcular(base).conferencias.some((c) => c.chave === chave)).toBe(false);
    for (const modo of ['equity_first', 'cash_demand', 'manual'] as const) {
      const outro = calcular({
        ...base,
        financiamento: { ...base.financiamento, modoSaque: modo, custoFinanceiroNaDemanda: false },
      });
      expect(outro.conferencias.some((c) => c.chave === chave)).toBe(false);
    }
  });

  it('a decomposição da demanda fecha: coberto por saque + descoberto ≤ demanda', () => {
    const base = casoDemanda();
    for (const out of [calcular(base), calcular({ ...base, financiamento: { ...base.financiamento, maxLtcPct: 0.2 } })]) {
      for (const m of out.meses) {
        expect(m.demandaCoberta + m.demandaDescoberta).toBeCloseTo(m.demandaDimensionada, 6);
        expect(m.demandaCoberta).toBeGreaterThanOrEqual(0);
        expect(m.demandaDescoberta).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('override de saque continua vencendo, inclusive acima do teto', () => {
    const base = casoDemanda();
    const out = calcular({
      ...base,
      financiamento: { ...base.financiamento, maxLtcPct: 0.2 },
      overrides: [{ mes: 5, linha: 'draw', valor: 900_000 }],
    });
    expect(out.meses[4].draw).toBe(900_000);
    expect(out.apuracao.dividaSacada).toBeGreaterThan(out.apuracao.tetoDivida);
  });

  it('modelagem em equity_first, cash_demand e manual não muda de resultado', () => {
    // Os três modos de sempre não enxergam nem o aporte previsto nem a demanda
    // líquida: o saque de cada um é exatamente o de antes desta migration.
    const b = casoBase();
    const comPlano = {
      ...b,
      aportes: {
        modoAporte: 'plano' as const,
        aporteBaseTotal: 732_778,
        valorTotalAlvo: 0,
        regraRateioCapital: 'participacao' as const,
        parcelas: [{ mes: 1, valor: 300_000 }, { mes: 14, valor: 150_000 }],
      },
    };
    const equityFirst = calcular(comPlano);
    // Saque limitado à obra do mês — o teto que o modo novo remove.
    for (const m of equityFirst.meses) {
      expect(m.draw).toBeLessThan(m.construction + DOLAR);
    }
    // E o caixa fica negativo, que é o problema de origem.
    expect(Math.min(...equityFirst.meses.map((m) => m.caixaAcumulado))).toBeLessThan(0);
    // Número fixado: é o que o modo produz hoje e o que ele tem de continuar
    // produzindo depois desta migration.
    expect(equityFirst.apuracao.dividaSacada).toBeCloseTo(1_005_000, 0);

    const manual = calcular({
      ...comPlano,
      financiamento: { ...b.financiamento, modoSaque: 'manual' as const },
    });
    expect(manual.apuracao.dividaSacada).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Release na demanda de caixa e linha rotativa (migration 1763300000)
//
// Três falhas corrigidas de uma vez:
//   1. a amortização por unidade vendida não entrava na demanda que dimensiona
//      o saque — o caixa fechava negativo nos meses de venda;
//   2. o teto dessa amortização incluía o saque do PRÓPRIO mês, o que fazia cada
//      dólar sacado liberar um dólar a mais de amortização;
//   3. a capacidade de saque nunca se recompunha quando a dívida era amortizada.
// ─────────────────────────────────────────────────────────────────────────────
describe('release na demanda e linha rotativa', () => {
  const COLCHAO = 100_000;

// 45 unidades a $875.000, takedowns de 3 a 4 unidades a partir do mês 14.
const takedowns: Takedown[] = [];
let restam = 45;
let mes = 14;
let ordem = 0;
while (restam > 0) {
  const q = Math.min(restam, ordem % 2 === 0 ? 4 : 3);
  takedowns.push({ unidadeIndex: 0, ordem: ordem++, mes, quantidade: q, precoUnitario: 0 });
  restam -= q;
  mes += 1;
}

const cenarioRelease = (patch: Partial<ModelInput['financiamento']> = {}): ModelInput => ({
  nome: 'Release 70%', dataInicio: '2025-01-01',
  mesesAprovacao: 6, mesesConstrucao: 12, mesesPosObra: 8, horizonteMaximo: 60,
  unidades: [
    { nome: 'Lote', quantidade: 45, custoTerreno: 55_000, custoObra: 430_000, precoVenda: 875_000, propertyTaxAno: 3_000 },
  ],
  custosAdicionais: [],
  aportes: { modoAporte: 'demanda', aporteBaseTotal: 3_000_000, valorTotalAlvo: 0, regraRateioCapital: 'participacao' },
  financiamento: {
    taxaAnual: 0.095, feeEstruturacaoPct: 0.01, feeTiming: 'first_draw',
    mesInicioSaque: 1, mesFimSaque: 26, modoSaque: 'cash_demand',
    maxLtcPct: null, valorContratado: null, custoFinanceiroNaDemanda: true,
    modoAmortizacao: 'at_exit', capitalizarJuros: false, colchaoMinimoCaixa: 100_000,
    linhaRotativa: false,
    reservaJuros: 0, reservaJurosSacada: true, prazoMeses: null, carenciaMeses: 0,
    amortizacaoMeses: null, balloonNoVencimento: true,
    releasePrice: 0, releasePricePct: 0.7,
    convencaoJuros: 'mensal_12', tipoTaxa: 'fixa', spread: 0, benchmarkNome: null, benchmarkPadrao: 0,
    ...patch,
  },
  socios: [{ nome: 'S', participacaoPct: 1, cotaDisponivel: false, aportes: [] }],
  receita: {
    comissaoPct: 0.05, custoCartorioPct: 0.01, modoVenda: 'takedown', mesSaida: 26,
    lucroInvestidoresPct: 0.8, lucroSponsorPct: 0.2, takedowns,
  },
  overrides: [],
});


  /** Aporte por PLANO: sem isso o aporte é resíduo de caixa e tampa o buraco. */
  const comPlanoDeAportes = (entrada: ModelInput): ModelInput => ({
    ...entrada,
    aportes: {
      modoAporte: 'plano', aporteBaseTotal: 3_000_000, valorTotalAlvo: 0,
      regraRateioCapital: 'participacao', parcelas: [{ mes: 1, valor: 3_000_000 }],
    },
  });

  it('sem release e sem linha rotativa, nada muda', () => {
    const referencia = calcular(casoBase());
    const out = calcular(comFin({ releasePrice: 0, releasePricePct: null, linhaRotativa: false }));
    expect(JSON.stringify(out.meses)).toBe(JSON.stringify(referencia.meses));
    expect(JSON.stringify(out.apuracao)).toBe(JSON.stringify(referencia.apuracao));
    expect(JSON.stringify(out.conferencias)).toBe(JSON.stringify(referencia.conferencias));
  });

  it('o release entra na demanda: o mês da venda fecha no colchão, não negativo', () => {
    const out = calcular(comPlanoDeAportes(cenarioRelease()));
    // Mês 14 é o primeiro takedown: 4 unidades × $875.000 × 70% = $2.450.000 de
    // release. Antes desta correção o saque era ZERO neste mês e o caixa fechava
    // negativo; agora o saque cobre o release e o caixa fecha no colchão.
    const m14 = out.meses[13];
    expect(m14.amortizacaoRelease).toBeCloseTo(2_450_000, 0);
    expect(m14.amortizacaoPrevista).toBeCloseTo(2_450_000, 0);
    expect(m14.draw).toBeGreaterThan(0);
    expect(m14.caixaAcumulado).toBeCloseTo(COLCHAO, 0);

    // A regra geral: todo mês com saque fecha EXATAMENTE no colchão. Sobrar
    // caixa num mês com saque seria dimensionamento inflado; faltar seria algo
    // ainda fora da demanda.
    for (const m of out.meses) {
      // Mês com aporte do plano fica de fora: o 'cash_demand' ignora o aporte do
      // próprio mês (é a diferença dele para o 'equity_first_demanda'), então o
      // caixa fecha acima do colchão pelo aporte, não por saque a mais.
      if (m.draw > 0.01 && m.equityCall <= 0.01) {
        expect(m.caixaAcumulado).toBeCloseTo(COLCHAO, 0);
      }
      expect(m.caixaAcumulado).toBeGreaterThan(COLCHAO - DOLAR);
    }
    expect(semaforo(out, 'caixa_minimo')).toBe('verde');
    expect(out.convergiu).toBe(true);
  });

  it('previsão e realização do release são o MESMO número', () => {
    const out = calcular(comPlanoDeAportes(cenarioRelease()));
    for (const m of out.meses) {
      // Fora do mês de saída, a amortização prevista É o release realizado.
      if (m.mes !== 26) expect(m.amortizacaoPrevista).toBeCloseTo(m.amortizacaoRelease, 6);
      expect(m.amortizacaoRelease).toBeLessThanOrEqual(m.amortization + DOLAR);
    }
  });

  it('o teto do release é o saldo de ABERTURA, e o saque não infla por isso', () => {
    // Janela de saque curta: a dívida acaba antes das vendas, e o release dos
    // últimos meses não tem o que amortizar.
    const out = calcular(comPlanoDeAportes(cenarioRelease({ mesFimSaque: 15 })));
    const cortados = out.meses.filter(
      (m) => m.unidadesVendidas > 0 && m.amortizacaoRelease < 0.7 * 875_000 * m.unidadesVendidas - DOLAR,
    );
    expect(cortados.length).toBeGreaterThan(0);
    for (const m of cortados) {
      // Amortizou exatamente o saldo de abertura — nunca mais que ele — e o mês
      // não sacou nada para amortizar mais.
      expect(m.saldoDevedor).toBeCloseTo(0, 2);
      expect(m.draw).toBe(0);
    }
    // E a conferência conta o que ficou de fora.
    const conf = out.conferencias.find((c) => c.chave === 'release_insuficiente')!;
    expect(conf.semaforo).toBe('ambar');
    expect(conf.detalhe).toMatch(/de release não chegaram a ser amortizados/);
  });

  it('com juros capitalizados o teto do release inclui os juros do saldo de abertura', () => {
    const out = calcular(comPlanoDeAportes(cenarioRelease({ mesFimSaque: 15, capitalizarJuros: true })));
    const cortado = out.meses.find((m) => m.unidadesVendidas > 0 && m.saldoDevedor === 0 && m.amortization > 0)!;
    expect(cortado).toBeTruthy();
    // Saldo de abertura + juros capitalizados do próprio mês, e nada além disso.
    const abertura = out.meses[cortado.mes - 2].saldoDevedor;
    expect(cortado.amortization).toBeCloseTo(abertura + cortado.juros, 2);
  });

  it('no mês da saída o at_exit não soma o release em dobro', () => {
    // Venda única no mês de saída com release: a previsão é release + o
    // remanescente do saldo de abertura, nunca os dois cheios.
    const base = comFin({ releasePricePct: 0.7, modoSaque: 'cash_demand', mesInicioSaque: 1, colchaoMinimoCaixa: 0 });
    const out = calcular(base);
    const saida = out.meses[out.meses.length - 1];
    const abertura = out.meses[out.meses.length - 2].saldoDevedor;
    expect(saida.amortizacaoPrevista).toBeCloseTo(Math.max(abertura, saida.amortizacaoRelease), 2);
    expect(saida.amortizacaoPrevista).toBeLessThan(abertura + saida.amortizacaoRelease);
    expect(saida.saldoDevedor).toBeCloseTo(0, 2);
    expect(semaforo(out, 'saldo_devedor_final')).toBe('verde');
  });

  it('a capacidade rotativa é teto − saldo de abertura, e se recompõe', () => {
    const teto = 0.7 * (45 * 55_000 + 45 * 430_000);
    const out = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: true, maxLtcPct: 0.7 })));
    for (let i = 0; i < out.meses.length; i++) {
      const abertura = i === 0 ? 0 : out.meses[i - 1].saldoDevedor;
      expect(out.meses[i].capacidadeSaque).toBeCloseTo(Math.max(0, teto - abertura), 2);
    }
    // Depois de um mês de release grande, a capacidade VOLTA a subir — é o que
    // "rotativa" quer dizer.
    const depoisDaVenda = out.meses[14].capacidadeSaque;
    expect(depoisDaVenda).toBeGreaterThan(out.meses[13].capacidadeSaque);
  });

  it('rotativa e não rotativa dão o mesmo resultado com teto folgado', () => {
    const nao = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: false })));
    const rot = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: true })));
    // Sem teto, `capacidadeSaque` é infinita nos dois e nada mais muda.
    expect(JSON.stringify(nao.meses)).toBe(JSON.stringify(rot.meses));
    expect(nao.apuracao.dividaSacada).toBeCloseTo(rot.apuracao.dividaSacada, 2);
  });

  it('com teto apertado, a não rotativa corta o saque e a rotativa fecha o caixa', () => {
    const nao = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: false, maxLtcPct: 0.7 })));
    const rot = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: true, maxLtcPct: 0.7 })));

    // Não rotativa: o teto vale para o total desembolsado, a capacidade acaba e
    // o caixa fica negativo.
    expect(Math.min(...nao.meses.map((m) => m.caixaAcumulado))).toBeLessThan(0);
    expect(semaforo(nao, 'caixa_minimo')).toBe('vermelho');

    // Rotativa: amortizar devolveu limite, e o caixa fecha no colchão.
    expect(Math.min(...rot.meses.map((m) => m.caixaAcumulado))).toBeCloseTo(COLCHAO, 0);
    expect(semaforo(rot, 'caixa_minimo')).toBe('verde');
    expect(rot.apuracao.dividaSacada).toBeGreaterThan(nao.apuracao.dividaSacada);
    expect(rot.convergiu).toBe(true);
  });

  it('teto_divida cobra o PICO do saldo na rotativa e o total sacado na não rotativa', () => {
    const nao = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: false, maxLtcPct: 0.7 })));
    const rot = calcular(comPlanoDeAportes(cenarioRelease({ linhaRotativa: true, maxLtcPct: 0.7 })));

    const confNao = nao.conferencias.find((c) => c.chave === 'teto_divida')!;
    const confRot = rot.conferencias.find((c) => c.chave === 'teto_divida')!;

    // O pico é menor que o total desembolsado justamente porque houve release.
    expect(rot.apuracao.saldoDevedorMaximo).toBeLessThan(rot.apuracao.dividaSacada);
    expect(confRot.semaforo).toBe('verde');
    expect(confRot.detalhe).toContain('PICO do saldo devedor');
    expect(confRot.detalhe).toContain('total desembolsado');
    expect(confNao.detalhe).not.toContain('PICO do saldo devedor');
    // O valor mostrado muda de grandeza junto com a leitura.
    expect(confRot.valor.startsWith(dinheiroUsd(rot.apuracao.saldoDevedorMaximo))).toBe(true);
    expect(confNao.valor.startsWith(dinheiroUsd(nao.apuracao.dividaSacada))).toBe(true);
  });

  it('saldoDevedorMaximo e ltcPico saem do mesmo fluxo', () => {
    const out = calcular(comPlanoDeAportes(cenarioRelease()));
    expect(out.apuracao.saldoDevedorMaximo).toBeCloseTo(
      Math.max(...out.meses.map((m) => m.saldoDevedor)),
      6,
    );
    const custoDireto = 45 * 55_000 + 45 * 430_000;
    expect(out.indicadores.ltcPico).toBeCloseTo(out.apuracao.saldoDevedorMaximo / custoDireto, 9);
    // O LTC por desembolso continua sendo o de sempre, e é MAIOR aqui.
    expect(out.indicadores.ltc).toBeCloseTo(out.apuracao.dividaSacada / custoDireto, 9);
    expect(out.indicadores.ltc!).toBeGreaterThan(out.indicadores.ltcPico!);
    // A dívida é integralmente quitada.
    expect(out.meses[out.meses.length - 1].saldoDevedor).toBeCloseTo(0, 2);
    expect(semaforo(out, 'saldo_devedor_final')).toBe('verde');
  });

  it('release acima do preço líquido acende vermelho com os dois números', () => {
    // 95% de release contra 94% de preço líquido: cada venda consome caixa.
    const out = calcular(cenarioRelease({ releasePricePct: 0.95 }));
    const conf = out.conferencias.find((c) => c.chave === 'release_acima_da_receita')!;
    expect(conf.semaforo).toBe('vermelho');
    expect(conf.detalhe).toContain('release de');
    expect(conf.detalhe).toContain('de preço líquido');
  });

  // ─── Base do fee de estruturação ────────────────────────────────────────────
  //
  // O fee incide sobre o COMPROMISSO da linha, não sobre o giro. Antes desta
  // correção incidia sobre `dividaSacada` — o total sacado ao longo da vida —, e
  // numa linha rotativa isso é um múltiplo do contratado, porque amortizar
  // devolve limite e o mesmo dinheiro é sacado várias vezes.

  it('fee é determinístico: o teto contratado manda, o giro não', () => {
    // MESMO teto e MESMO percentual, dois cenários de saque deliberadamente
    // distintos: um rotativo (que gira o limite e desembolsa muito mais que o
    // contratado) e um não rotativo (que satura o teto e para). O fee tem de sair
    // exatamente igual nos dois — é essa a definição de "incide sobre o
    // contratado".
    const contratado = { valorContratado: 1_000_000, feeEstruturacaoPct: 0.02 };
    const gira = calcular(comPlanoDeAportes(cenarioRelease({ ...contratado, linhaRotativa: true })));
    const naoGira = calcular(comPlanoDeAportes(cenarioRelease({ ...contratado, linhaRotativa: false })));

    expect(gira.apuracao.feeTotal).toBeCloseTo(20_000, 2);
    expect(naoGira.apuracao.feeTotal).toBeCloseTo(20_000, 2);
    expect(gira.apuracao.baseFeeEstruturacao).toBeCloseTo(1_000_000, 2);
    expect(naoGira.apuracao.baseFeeEstruturacao).toBeCloseTo(1_000_000, 2);

    // E os dois cenários são de fato muito diferentes: se os saques coincidissem,
    // o teste não estaria provando nada.
    expect(gira.apuracao.dividaSacada).toBeGreaterThan(naoGira.apuracao.dividaSacada * 1.5);
    // O giro é MÚLTIPLO do contratado — aqui o rotativo desembolsa 4× o limite —,
    // e é exatamente por esse múltiplo que o fee inflava antes.
    expect(gira.apuracao.dividaSacada).toBeGreaterThan(3 * 1_000_000);
    expect(gira.apuracao.dividaSacada * 0.02).toBeGreaterThan(3 * gira.apuracao.feeTotal);

    // O fee é lançado num mês só, e a soma do fluxo é a apuração.
    expect(soma(gira.meses.map((m) => m.fee))).toBeCloseTo(20_000, 2);
    expect(gira.meses.filter((m) => m.fee > 0)).toHaveLength(1);
  });

  it('linha rotativa com release: o fee para de crescer com o giro', () => {
    // O caso que originou o chamado. Teto contratado de $10M, release price a
    // 70%: cada venda amortiza, devolve limite e o mesmo dinheiro é sacado de
    // novo. O desembolso da vida do empréstimo passa MUITO do contratado.
    const out = calcular(
      comPlanoDeAportes(cenarioRelease({ linhaRotativa: true, valorContratado: 10_000_000 })),
    );

    // A base é o contratado, e nada mais.
    expect(out.apuracao.baseFeeEstruturacao).toBeCloseTo(10_000_000, 2);
    expect(out.apuracao.feeTotal).toBeCloseTo(100_000, 2);

    // O que o fee teria sido pela fórmula antiga, sobre o total desembolsado.
    // Não é a mesma coisa nem de longe — e é essa diferença que o chamado
    // enxergou na tela.
    const feePelaFormulaAntiga = out.apuracao.dividaSacada * 0.01;
    expect(feePelaFormulaAntiga).toBeGreaterThan(out.apuracao.feeTotal * 1.5);

    // O giro é real: sacou-se bem mais que o contratado, e o PICO respeitou o
    // teto o tempo todo. É exatamente por isso que cobrar fee sobre o desembolso
    // estava errado — o banco nunca esteve exposto a mais que o contratado.
    expect(out.apuracao.dividaSacada).toBeGreaterThan(10_000_000);
    expect(out.apuracao.saldoDevedorMaximo).toBeLessThanOrEqual(10_000_000 + DOLAR);
    expect(semaforo(out, 'teto_divida')).toBe('verde');
    expect(out.convergiu).toBe(true);
  });

  it('sem teto nenhum: base é o pico, âmbar acende, e nada de NaN ou Infinity', () => {
    // Os dois nulos: `tetoDivida` é Infinity, e Infinity NÃO pode virar base de
    // cálculo. A base cai no pico do saldo devedor — a maior exposição que o
    // banco de fato teve.
    const out = calcular(
      comPlanoDeAportes(cenarioRelease({ valorContratado: null, maxLtcPct: null })),
    );

    expect(out.apuracao.tetoDivida).toBe(Number.POSITIVE_INFINITY);
    expect(out.apuracao.baseFeeEstruturacao).toBeCloseTo(out.apuracao.saldoDevedorMaximo, 2);
    expect(out.apuracao.feeTotal).toBeCloseTo(out.apuracao.saldoDevedorMaximo * 0.01, 2);

    // A guarda que este teste existe para dar: nenhum número do output é NaN nem
    // Infinity por causa do teto infinito. `tetoDivida` é a ÚNICA exceção, e é
    // deliberada — "sem teto" é a informação.
    for (const [chave, v] of Object.entries(out.apuracao)) {
      if (chave === 'tetoDivida') continue;
      expect(Number.isFinite(v), `apuracao.${chave} = ${v}`).toBe(true);
    }
    for (const [chave, v] of Object.entries(out.indicadores)) {
      expect(v === null || Number.isFinite(v), `indicadores.${chave} = ${v}`).toBe(true);
    }
    for (const m of out.meses) {
      for (const [chave, v] of Object.entries(m)) {
        if (typeof v !== 'number') continue;
        // `capacidadeSaque` é Infinity por definição quando não há teto: é a
        // leitura honesta de "pode sacar o que precisar", e a tela já a mostra
        // como "sem teto" em vez de um número.
        if (chave === 'capacidadeSaque') continue;
        expect(Number.isFinite(v), `mes ${m.mes}.${chave} = ${v}`).toBe(true);
      }
    }

    const conf = out.conferencias.find((c) => c.chave === 'fee_sem_base_contratada')!;
    expect(conf.semaforo).toBe('ambar');
    expect(conf.valor).toBe(dinheiroUsd(out.apuracao.baseFeeEstruturacao));
    expect(conf.detalhe).toContain('pico do saldo devedor');
    expect(conf.comoResolver).toContain('valor contratado');
    // Aviso, não impedimento.
    expect(bloqueiaSalvamento(out.conferencias)).toEqual([]);
  });

  it('fee zero não emite a conferência de base', () => {
    // Sem fee não há base a discutir, e a conferência não entra na lista — nem
    // verde. Toda modelagem sem fee segue com as conferências que sempre teve.
    const semFee = calcular(
      comPlanoDeAportes(cenarioRelease({ feeEstruturacaoPct: 0, valorContratado: null, maxLtcPct: null })),
    );
    expect(semFee.conferencias.some((c) => c.chave === 'fee_sem_base_contratada')).toBe(false);
    expect(semFee.apuracao.feeTotal).toBe(0);

    // Com fee e sem teto, entra.
    const comFee = calcular(
      comPlanoDeAportes(cenarioRelease({ feeEstruturacaoPct: 0.01, valorContratado: null, maxLtcPct: null })),
    );
    expect(comFee.conferencias.some((c) => c.chave === 'fee_sem_base_contratada')).toBe(true);
  });

  it('só o fee muda: base coincidindo com o sacado, o output é o de antes', () => {
    // A prova de que nada mais foi tocado por acidente. Numa linha NÃO rotativa
    // que satura o teto, o total desembolsado é exatamente o teto — ou seja, a
    // base nova (`valorContratado`) e a base antiga (`dividaSacada`) são o MESMO
    // número. Se a correção tivesse mexido em qualquer outra coisa, os números
    // divergiriam aqui; como a única mudança é a base do fee, e ela coincide, o
    // resultado é idêntico ao que o motor antigo produzia.
    const contratado = calcular(
      comPlanoDeAportes(cenarioRelease({ linhaRotativa: false, valorContratado: 14_000_000 })),
    );
    expect(contratado.apuracao.dividaSacada).toBeCloseTo(14_000_000, 2);
    expect(contratado.apuracao.baseFeeEstruturacao).toBeCloseTo(contratado.apuracao.dividaSacada, 2);
    expect(contratado.apuracao.feeTotal).toBeCloseTo(140_000, 2);

    // Mesmo raciocínio pela via do LTC máximo: 60% do custo direto satura, e o
    // sacado bate na base.
    const porLtc = calcular(
      comPlanoDeAportes(cenarioRelease({ linhaRotativa: false, maxLtcPct: 0.6 })),
    );
    const custoDireto = 45 * 55_000 + 45 * 430_000;
    expect(porLtc.apuracao.baseFeeEstruturacao).toBeCloseTo(0.6 * custoDireto, 2);
    expect(porLtc.apuracao.dividaSacada).toBeCloseTo(porLtc.apuracao.baseFeeEstruturacao, 2);

    // E o caso base do arquivo inteiro é a outra metade da prova: ele não tem
    // teto, então a base é o pico — e num projeto sem amortização antes da saída
    // o pico É o total desembolsado. Por isso os ~260 números fixados no caso
    // base, todos anteriores a esta correção, continuam batendo sem um ajuste.
    const base = calcular(casoBase());
    expect(base.apuracao.baseFeeEstruturacao).toBeCloseTo(base.apuracao.dividaSacada, 2);
    expect(base.apuracao.feeTotal).toBeCloseTo(base.apuracao.dividaSacada * 0.015, 2);
  });

  it('com teto, o fee estabiliza na primeira passada e o ponto fixo encurta', () => {
    // Com teto declarado `baseFeeEstruturacao` não lê `meses`: o fee não depende
    // mais da passada, e uma das três realimentações do ponto fixo desaparece.
    // No cenário do chamado isso se vê no contador de iterações.
    const comTeto = calcular(
      comPlanoDeAportes(cenarioRelease({ linhaRotativa: true, valorContratado: 14_000_000 })),
    );
    const semTeto = calcular(
      comPlanoDeAportes(cenarioRelease({ linhaRotativa: true, valorContratado: null, maxLtcPct: null })),
    );
    expect(comTeto.convergiu).toBe(true);
    expect(semTeto.convergiu).toBe(true);
    // Sem teto o fee ainda realimenta — pelo pico, de forma amortecida —, e por
    // isso consome mais passadas que o caso com teto.
    expect(comTeto.iteracoes).toBeLessThan(semTeto.iteracoes);
  });
});
