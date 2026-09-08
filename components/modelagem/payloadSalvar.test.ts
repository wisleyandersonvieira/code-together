/**
 * Guardas da tradução ModelInput → payload da salvar_modelagem, e de volta.
 *
 * O que estes testes cobram é EXATAMENTE o que o teste diferencial de pg_dump
 * pega do outro lado do fio: se o payload sair errado daqui, a função grava
 * certo o dado errado, e nenhum dos dois acusa nada.
 *
 * A varredura de chaves nulas é o coração: `undefined` some do JSON e vira
 * "chave ausente", que a função lê como "não mexa nesta coluna". Numa coluna em
 * que NULL significa "derivado", isso é o valor antigo reaparecendo sozinho.
 */
import { describe, expect, it } from 'vitest';
import { carimbarIds, montarPayload, type RetornoSalvar } from './payloadSalvar';
import type { ModelInput } from '@/lib/modelagem';

/** Locação mínima com uma linha em cada lista que o payload traduz. */
function base(): ModelInput {
  return {
    nome: 'Torre Sul',
    tipoModelagem: 'locacao',
    dataInicio: '2026-03-01',
    mesesAprovacao: 6,
    mesesConstrucao: 18,
    mesesPosObra: 3,
    horizonteMaximo: 120,
    unidades: [
      { id: 1, nome: 'Torre A', quantidade: 1, areaSf: 30000, aluguelSfAno: 32,
        custoTerreno: 1_000_000, custoObra: 6_000_000, precoVenda: 0, propertyTaxAno: 0 },
      { nome: 'Torre C', quantidade: 1, areaSf: 12000, aluguelSfAno: 28,
        custoTerreno: 400_000, custoObra: 2_200_000, precoVenda: 0, propertyTaxAno: 0 },
    ],
    custosAdicionais: [
      { id: 7, label: 'Sitework', valor: 450_000, distribuicao: 'manual', mesAncora: 7,
        categoria: 'sitework', grupoPaiId: 3, baseCalculo: 'total', valorUnitario: 0,
        percentual: 0, gatilho: 'cronograma',
        parcelas: [{ ordem: 0, mes: 9, valor: 230_000 }] },
    ],
    socios: [
      { id: 4, nome: 'Sponsor', participacaoPct: 0.3, cotaDisponivel: false, pctCapital: null,
        aportes: [{ ordem: 0, mes: 3, valor: 500_000 }] },
    ],
    fases: [{ ordem: 0, nome: 'Fase 1', dataInicio: '2026-03-01', dataFim: '2027-03-01' }],
    alocacoes: [{ unidadeIndex: 0, faseIndex: 0, quantidade: 1 }],
    financiamentos: [
      { id: 9, nome: 'Permanent', refinanciaIndex: 0, taxaAnual: 0.065, feeEstruturacaoPct: 0,
        feeTiming: 'first_draw', feeMes: null, mesInicioSaque: 28, mesFimSaque: 30,
        modoSaque: 'equity_first', maxLtcPct: null, valorContratado: 5_000_000,
        custoFinanceiroNaDemanda: false, modoAmortizacao: 'at_exit', capitalizarJuros: false,
        colchaoMinimoCaixa: 0, linhaRotativa: false, reservaJuros: 0, reservaJurosSacada: true,
        prazoMeses: 120, carenciaMeses: 0, amortizacaoMeses: null, balloonNoVencimento: true,
        releasePrice: 0, releasePricePct: null, convencaoJuros: 'mensal_12', tipoTaxa: 'variavel',
        spread: 0.02, benchmarkNome: 'SOFR', benchmarkPadrao: 0.04,
        benchmarkCurva: [{ mes: 12, valor: 0.045 }] },
    ],
    receita: {
      comissaoPct: 0, custoCartorioPct: 0, modoVenda: 'single_exit', mesSaida: null,
      lucroInvestidoresPct: 0.8, lucroSponsorPct: 0.2,
      takedowns: [{ unidadeIndex: 0, faseIndex: null, ordem: 0, mes: 42, quantidade: 1,
                    precoUnitario: 8_500_000 }],
      vendasPorUnidade: [{ unidadeIndex: 0, mesVenda: 66 }],
    },
    locacao: { taxaReembolsoPct: 0.85, perdaCreditoPct: 0.02, capRateSaida: 0.065,
               custoVendaPct: 0.02, noiReferencia: 'estabilizado', ocupacaoEstabilizadaPct: 0.95,
               mesInicioOpex: null },
    opex: [{ ordem: 0, label: 'Property tax', valorSfAno: 3.2, reembolsavel: true }],
    ocupacao: [{ mes: 24, ocupacaoPct: 0.6 }],
  } as ModelInput;
}

/** O payload como ele CHEGA no banco: passado por JSON, que é onde o undefined some. */
const viaJson = (m: ModelInput) => JSON.parse(JSON.stringify(montarPayload(1, m)));

describe('montarPayload — as chaves cujo null tem significado', () => {
  it('mes_inicio_opex null SOBREVIVE ao JSON — é "derivado", não "não veio"', () => {
    const p = viaJson(base());
    expect(Object.prototype.hasOwnProperty.call(p.locacao, 'mes_inicio_opex')).toBe(true);
    expect(p.locacao.mes_inicio_opex).toBeNull();
  });

  it('mes_inicio_opex declarado viaja como número', () => {
    const m = base();
    m.locacao!.mesInicioOpex = 30;
    expect(viaJson(m).locacao.mes_inicio_opex).toBe(30);
  });

  it('pct_capital nulo vai como string vazia, como a action de hoje manda', () => {
    // NULLIF(NULLIF(x,''),'null') do lado do banco. Zero seria "não põe capital
    // nenhum"; vazio é "usa a participação".
    expect(viaJson(base()).socios[0].pct_capital).toBe('');
    const m = base();
    m.socios![0].pctCapital = 0.1;
    expect(viaJson(m).socios[0].pct_capital).toBe('0.1');
  });

  it('mesAncora, faseIndex, mesSaida e os nuláveis da facilidade chegam como null', () => {
    const p = viaJson(base());
    expect(p.receita.mes_saida).toBeNull();
    expect(p.takedowns[0].fase_index).toBeNull();
    expect(p.facilidades[0].fee_mes).toBeNull();
    expect(p.facilidades[0].max_ltc_pct).toBeNull();
    expect(p.facilidades[0].amortizacao_meses).toBeNull();
    // E o que NÃO é nulo continua não sendo.
    expect(p.custos[0].mes_ancora).toBe(7);
  });

  it('nenhuma chave do payload some por undefined', () => {
    // A varredura que pega o erro genérico: qualquer campo novo que alguém
    // acrescente com `?? undefined` cai aqui antes de virar bug silencioso.
    const cru = montarPayload(1, base());
    const perdidas: string[] = [];
    const varrer = (v: unknown, caminho: string) => {
      if (v === undefined) perdidas.push(caminho);
      else if (Array.isArray(v)) v.forEach((x, i) => varrer(x, `${caminho}[${i}]`));
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) varrer(x, `${caminho}.${k}`);
    };
    varrer(cru, 'payload');
    expect(perdidas).toEqual([]);
  });
});

describe('montarPayload — índices e ids', () => {
  it('grupo_pai viaja como ID, não como índice', () => {
    // A tela só oferece como pai um custo com id != null. Indexar seria
    // funcionalidade nova, não paridade.
    const p = viaJson(base());
    expect(p.custos[0].grupo_pai_id).toBe(3);
    expect(p.custos[0]).not.toHaveProperty('grupo_pai_index');
  });

  it('refinancia_index viaja como ÍNDICE — o alvo pode não existir ainda', () => {
    expect(viaJson(base()).facilidades[0].refinancia_index).toBe(0);
  });

  it('linha sem id vai com id null, e a ordem vem da posição no array', () => {
    const p = viaJson(base());
    expect(p.unidades.map((u: any) => [u.id, u.ordem])).toEqual([[1, 0], [null, 1]]);
  });

  it('parcelas e aportes vão ANINHADOS no pai, nunca em lista paralela', () => {
    const p = viaJson(base());
    expect(p.custos[0].parcelas).toHaveLength(1);
    expect(p.socios[0].aportes).toHaveLength(1);
    expect(p).not.toHaveProperty('custo_parcelas');
  });
});

describe('montarPayload — modo de negócio', () => {
  it('numa VENDA os três blocos de locação não viajam', () => {
    // Mandá-los criaria linha de cabeçalho: inofensiva, mas mentirosa — a
    // tabela passaria a dizer que existe uma operação onde não existe.
    const m = base();
    m.tipoModelagem = 'venda';
    const p = viaJson(m);
    expect(p).not.toHaveProperty('locacao');
    expect(p).not.toHaveProperty('opex');
    expect(p).not.toHaveProperty('ocupacao');
    expect(p.premissas.tipo_modelagem).toBe('venda');
  });

  it('sem plano de aportes a chave não viaja — não se cria cabeçalho vazio', () => {
    const m = base();
    delete (m as any).aportes;
    expect(viaJson(m)).not.toHaveProperty('aportes');
  });
});

describe('carimbarIds', () => {
  const retorno: RetornoSalvar = {
    id: 1,
    unidades: [1, 55],
    custos: [7],
    custo_parcelas: { '7': [88] },
    socios: [4],
    socio_aportes: { '4': [99] },
    fases: [12],
    facilidades: [9],
    opex: [21],
    takedowns: [31],
  };

  it('carimba os ids novos e preserva os que já existiam', () => {
    const m = carimbarIds(base(), retorno);
    expect(m.unidades.map((u) => u.id)).toEqual([1, 55]);
    expect(m.custosAdicionais![0].parcelas[0].id).toBe(88);
    expect(m.socios![0].aportes[0].id).toBe(99);
    expect(m.fases![0].id).toBe(12);
    expect(m.opex![0].id).toBe(21);
    expect(m.receita.takedowns![0].id).toBe(31);
  });

  it('id que voltou nulo NÃO apaga o id que já havia', () => {
    // Perder o id de uma linha que existe faria o salvamento seguinte
    // inseri-la de novo — é o pior desfecho possível deste passo.
    const m = carimbarIds(base(), { ...retorno, unidades: [null, 55] });
    expect(m.unidades[0].id).toBe(1);
  });

  it('retorno mais curto que o rascunho não desloca nem apaga nada', () => {
    const m = carimbarIds(base(), { id: 1, unidades: [1] });
    expect(m.unidades.map((u) => u.id)).toEqual([1, undefined]);
  });

  it('não muta o rascunho — é estado do React', () => {
    const antes = base();
    const copia = JSON.parse(JSON.stringify(antes));
    carimbarIds(antes, retorno);
    expect(JSON.parse(JSON.stringify(antes))).toEqual(copia);
  });

  it('o carimbo torna o payload seguinte idempotente', () => {
    // A prova de por que este passo existe: sem ele, o segundo salvamento
    // mandaria id:null de novo e a função apagaria e recriaria as mesmas linhas.
    const p = viaJson(carimbarIds(base(), retorno));
    expect(p.unidades.every((u: any) => u.id != null)).toBe(true);
    expect(p.custos[0].parcelas.every((x: any) => x.id != null)).toBe(true);
  });
});
