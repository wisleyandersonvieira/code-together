/**
 * Ponte entre as linhas do banco e o `ModelInput` do motor.
 *
 * Existe por um motivo específico: as colunas DECIMAL do Postgres chegam ao
 * cliente como STRING. Sem coerção explícita, `custo_terreno + custo_obra` vira
 * concatenação de texto e o modelo inteiro sai errado sem lançar erro nenhum.
 */
import type {
  AlocacaoFase,
  AporteParcela,
  ConvencaoJuros,
  PontoBenchmark,
  BaseCalculoCusto,
  CategoriaCusto,
  CustoAdicional,
  GatilhoCusto,
  Fase,
  ModelInput,
  Override,
  ParcelaCusto,
  PlanoAportes,
  RegraRateioCapital,
  Socio,
  SocioAporte,
  Takedown,
  Unidade,
} from './tipos';
import {
  BASES_CALCULO_CUSTO,
  CATEGORIAS_CUSTO,
  CONVENCOES_JUROS,
  GATILHOS_CUSTO,
  LINHAS_FLUXO,
  MODOS_AMORTIZACAO,
  REGRAS_RATEIO_CAPITAL,
} from './tipos';

/** Número tolerante: string do Postgres, null, undefined ou '' viram `padrao`. */
export const num = (v: unknown, padrao = 0): number => {
  if (v === null || v === undefined || v === '') return padrao;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : padrao;
};

const texto = (v: unknown, padrao = ''): string =>
  v === null || v === undefined ? padrao : String(v);

const bool = (v: unknown, padrao = false): boolean => {
  if (v === null || v === undefined) return padrao;
  if (typeof v === 'boolean') return v;
  return v === 't' || v === 'true' || v === 1 || v === '1';
};

/** Inteiro opcional: mantém `null` em vez de virar 0, que teria outro significado. */
const inteiroOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const numeroOuNulo = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Data ISO 'YYYY-MM-DD' a partir do que o driver devolver (date ou timestamp). */
export const dataIso = (v: unknown, padrao = '2025-01-01'): string => {
  if (!v) return padrao;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : padrao;
};

/** Linha de `loadModelagemCompleta`, com os filhos já agregados em JSON. */
export interface LinhaModelagem {
  id: number;
  [k: string]: any;
}

const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/**
 * Tipologias. Os valores da linha são POR UNIDADE — quem multiplica é o motor.
 *
 * `aporte_base` não é mais lido: virou premissa do projeto em `modelagem_aportes`
 * (migration 1761000000). A coluna continua no banco, deprecada.
 */
export function mapearUnidades(linhas: unknown): Unidade[] {
  return lista(linhas).map((u) => ({
    id: num(u.id) || undefined,
    nome: texto(u.nome),
    cidade: texto(u.cidade),
    areaSf: num(u.area_sf),
    custoTerreno: num(u.custo_terreno),
    custoObra: num(u.custo_obra),
    precoVenda: num(u.preco_venda),
    propertyTaxAno: num(u.property_tax_ano),
    // Sem linha ainda gravada, 1 é o que reproduz o comportamento anterior.
    quantidade: Math.max(1, Math.trunc(num(u.quantidade, 1))),
  }));
}

/** Parcelas do plano (`modelagem_aporte_parcelas`), sempre ordenadas por mês. */
export function mapearParcelasAporte(linhas: unknown): AporteParcela[] {
  return lista(linhas)
    .map((p) => ({
      id: num(p.id) || undefined,
      mes: Math.max(1, Math.trunc(num(p.mes, 1))),
      valor: num(p.valor),
      observacao: p.observacao == null ? null : String(p.observacao),
    }))
    .sort((a, b) => a.mes - b.mes);
}

/**
 * Plano de aportes (`modelagem_aportes` + `modelagem_aporte_parcelas`).
 *
 * Sem linha de cabeçalho o retorno é o PADRÃO NEUTRO — modo 'demanda', tudo
 * zerado, parcelas vazias — em vez de `undefined`: o motor não pode falhar por
 * input incompleto, e a aba Aportes precisa de um objeto para editar. Modelagem
 * sem linha calcula igual a antes da migration 1761000000.
 */
export function mapearAportes(linha: unknown, parcelas?: unknown): PlanoAportes {
  const a = (linha && typeof linha === 'object' ? linha : {}) as Record<string, unknown>;
  return {
    modoAporte: (a.modo_aporte === 'plano' ? 'plano' : 'demanda') as PlanoAportes['modoAporte'],
    aporteBaseTotal: num(a.aporte_base_total),
    valorTotalAlvo: num(a.valor_total_alvo),
    parcelas: mapearParcelasAporte(parcelas),
    // 'participacao' é o default da coluna (migration 1763100000) e o que
    // reproduz o rateio anterior para toda modelagem já gravada — inclusive as
    // que nem têm linha em modelagem_aportes.
    regraRateioCapital: REGRAS_RATEIO_CAPITAL.includes(
      a.regra_rateio_capital as RegraRateioCapital,
    )
      ? (a.regra_rateio_capital as RegraRateioCapital)
      : 'participacao',
  };
}

/**
 * Fases (`modelagem_fases`). As datas ficam como ISO: o índice do mês é derivado
 * pelo motor a partir de `modelagens.data_inicio`, nunca gravado.
 */
export function mapearFases(linhas: unknown): Fase[] {
  return lista(linhas)
    .map((f, i) => ({
      id: num(f.id) || undefined,
      ordem: Math.trunc(num(f.ordem, i)),
      nome: texto(f.nome),
      dataInicio: dataIso(f.data_inicio),
      dataFim: dataIso(f.data_fim),
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

/**
 * Alocação de unidades por fase (`modelagem_unidade_fases`).
 *
 * O banco guarda por id e o motor trabalha por índice, igual à venda por unidade.
 * Linha que aponta para uma unidade ou fase que não existe mais é descartada —
 * o banco tem CASCADE nas duas pontas, então isso só acontece com dado em trânsito.
 */
export function mapearAlocacoes(
  linhas: unknown,
  indicePorUnidade: Map<number, number>,
  indicePorFase: Map<number, number>,
): AlocacaoFase[] {
  return lista(linhas)
    .map((a) => ({
      id: num(a.id) || undefined,
      unidadeIndex: indicePorUnidade.get(num(a.unidade_id)) ?? -1,
      faseIndex: indicePorFase.get(num(a.fase_id)) ?? -1,
      quantidade: Math.max(0, Math.trunc(num(a.quantidade))),
    }))
    .filter((a) => a.unidadeIndex >= 0 && a.faseIndex >= 0);
}

/**
 * Parcelas de um custo (`modelagem_custo_parcelas`), sempre ordenadas por mês.
 *
 * Sub-select ausente ou nulo vira LISTA VAZIA, nunca `undefined`: zero parcelas é
 * o comportamento anterior à migration 1763000000 (100% no mês âncora), e é o que
 * toda linha já gravada tem.
 *
 * Duas parcelas no mesmo mês são preservadas as duas — o motor soma. Deduplicar
 * aqui apagaria input do usuário em silêncio.
 */
export function mapearParcelasCusto(linhas: unknown): ParcelaCusto[] {
  return lista(linhas)
    .map((p, i) => ({
      id: num(p.id) || undefined,
      ordem: Math.trunc(num(p.ordem, i)),
      // DECIMAL(15,2) chega como STRING. Sem num(), "14000.00" somado às demais
      // parcelas seria concatenação de texto e o custo lançaria um absurdo — ou
      // NaN — sem erro nenhum.
      valor: num(p.valor),
      mes: Math.max(1, Math.trunc(num(p.mes, 1))),
    }))
    .sort((a, b) => a.mes - b.mes || a.ordem - b.ordem);
}

/**
 * Custos adicionais (`modelagem_custos`).
 *
 * `categoria` cai em 'outros' quando vem nula ou desconhecida — o mesmo default
 * da coluna (migration 1761200000), e o que reproduz o comportamento anterior
 * para toda linha já gravada.
 */
export function mapearCustos(linhas: unknown): CustoAdicional[] {
  return lista(linhas).map((c) => ({
    id: num(c.id) || undefined,
    label: texto(c.label),
    valor: num(c.valor),
    distribuicao: (c.distribuicao ?? 'linear_construction') as CustoAdicional['distribuicao'],
    mesAncora: inteiroOuNulo(c.mes_ancora),
    categoria: CATEGORIAS_CUSTO.includes(c.categoria as CategoriaCusto)
      ? (c.categoria as CategoriaCusto)
      : 'outros',
    // Id de outra linha de modelagem_custos, não valor numérico de cálculo — mas
    // chega como INTEGER e passa pela mesma coerção das demais chaves.
    grupoPaiId: inteiroOuNulo(c.grupo_pai),
    // 'total' é o default da coluna (migration 1761300000) e o que reproduz o
    // comportamento anterior para toda linha já gravada.
    baseCalculo: BASES_CALCULO_CUSTO.includes(c.base_calculo as BaseCalculoCusto)
      ? (c.base_calculo as BaseCalculoCusto)
      : 'total',
    // DECIMAL(15,4) — chega como STRING. Sem num(), "214.3750" × 81000 daria NaN
    // e o custo sumiria do orçamento sem erro nenhum.
    valorUnitario: num(c.valor_unitario),
    // Categoria de referência do percentual. `null` quando ausente ou fora da
    // lista — o motor devolve 0 e `custo_base_zerada` acusa.
    grupoReferencia: CATEGORIAS_CUSTO.includes(c.grupo_referencia as CategoriaCusto)
      ? (c.grupo_referencia as CategoriaCusto)
      : null,
    // DECIMAL(9,6) — também chega como STRING. "0.050000" sem num() seria texto,
    // e "0.050000" × base daria coerção implícita silenciosa.
    percentual: num(c.percentual),
    // 'cronograma' é o default da coluna (migration 1761500000) e o que reproduz
    // o comportamento anterior para toda linha já gravada.
    gatilho: GATILHOS_CUSTO.includes(c.gatilho as GatilhoCusto)
      ? (c.gatilho as GatilhoCusto)
      : 'cronograma',
    // Vêm ANINHADAS no custo pelo `loadModelagemCompleta`, e não como segunda
    // lista a ser cruzada por id: o cruzamento é justamente onde uma parcela de
    // custo recém-criado se perderia.
    parcelas: mapearParcelasCusto(c.parcelas),
  }));
}

/**
 * Takedowns (`modelagem_takedowns`).
 *
 * O banco guarda por id e o motor trabalha por índice, igual à venda por unidade
 * e à alocação por fase. Lote que aponta para uma tipologia que não existe mais é
 * descartado — o banco tem CASCADE, então isso só acontece com dado em trânsito.
 * A fase é opcional: `faseIndex` nulo é lote sem fase declarada, não erro.
 */
export function mapearTakedowns(
  linhas: unknown,
  indicePorUnidade: Map<number, number>,
  indicePorFase: Map<number, number>,
): Takedown[] {
  return lista(linhas)
    .map((t, i) => ({
      id: num(t.id) || undefined,
      unidadeIndex: indicePorUnidade.get(num(t.unidade_id)) ?? -1,
      faseIndex: t.fase_id == null ? null : (indicePorFase.get(num(t.fase_id)) ?? null),
      ordem: Math.trunc(num(t.ordem, i)),
      mes: Math.max(1, Math.trunc(num(t.mes, 1))),
      quantidade: Math.max(0, Math.trunc(num(t.quantidade))),
      // DECIMAL(15,2) — chega como STRING. Sem num(), "875000.00" × quantidade
      // seria concatenação e a receita sairia errada sem erro nenhum.
      precoUnitario: num(t.preco_unitario),
      observacao: t.observacao == null ? null : String(t.observacao),
    }))
    .filter((t) => t.unidadeIndex >= 0)
    .sort((a, b) => a.ordem - b.ordem || a.mes - b.mes);
}

/**
 * Curva do benchmark (`modelagem_benchmark_curva`), sempre ordenada por mês.
 *
 * Mês AUSENTE não é benchmark zero — cai em `benchmarkPadrao` no motor. Uma linha
 * com valor 0 declara benchmark zero naquele mês; é a mesma distinção entre
 * "vazio" e "zero" que vale para os overrides.
 */
export function mapearBenchmarkCurva(linhas: unknown): PontoBenchmark[] {
  return lista(linhas)
    .map((p) => ({
      id: num(p.id) || undefined,
      mes: Math.max(1, Math.trunc(num(p.mes, 1))),
      // DECIMAL(9,6) chega como STRING. Sem num(), "0.045000" + spread seria
      // concatenação de texto e a taxa sairia absurda sem erro nenhum.
      valor: num(p.valor),
    }))
    .sort((a, b) => a.mes - b.mes);
}

/**
 * Aportes de um sócio (`modelagem_socio_aportes`), sempre ordenados por mês.
 *
 * Sub-select ausente ou nulo vira LISTA VAZIA, nunca `undefined`: nenhum aporte é
 * o estado de toda linha já gravada, e é o que mantém a regra 'participacao'
 * calculando como antes.
 *
 * Dois aportes no mesmo mês são preservados os dois — o motor soma. Deduplicar
 * aqui apagaria input do usuário em silêncio.
 */
export function mapearSocioAportes(linhas: unknown): SocioAporte[] {
  return lista(linhas)
    .map((a, i) => ({
      id: num(a.id) || undefined,
      ordem: Math.trunc(num(a.ordem, i)),
      // DECIMAL(15,2) chega como STRING. Sem num(), "250000.00" somado aos demais
      // aportes seria concatenação de texto e o equity do mês sairia absurdo — ou
      // NaN — sem erro nenhum.
      valor: num(a.valor),
      mes: Math.max(1, Math.trunc(num(a.mes, 1))),
      observacao: a.observacao == null ? null : String(a.observacao),
    }))
    .sort((a, b) => a.mes - b.mes || a.ordem - b.ordem);
}

export function mapearSocios(linhas: unknown): Socio[] {
  return lista(linhas).map((s) => ({
    id: num(s.id) || undefined,
    nome: texto(s.nome),
    participacaoPct: num(s.participacao_pct),
    cotaDisponivel: bool(s.cota_disponivel),
    // `null` é diferente de zero aqui, e a distinção é o comportamento default:
    // nulo é "usa participacao_pct", zero seria "não põe capital nenhum". Por
    // isso `numeroOuNulo` e não `num`.
    pctCapital: numeroOuNulo(s.pct_capital),
    // Vêm ANINHADOS no sócio pelo `loadModelagemCompleta`, e não como segunda
    // lista a ser cruzada por id: o cruzamento é justamente onde o aporte de um
    // sócio recém-criado se perderia.
    aportes: mapearSocioAportes(s.aportes),
  }));
}

export function mapearOverrides(linhas: unknown): Override[] {
  return lista(linhas)
    .filter((o) => LINHAS_FLUXO.includes(o.linha))
    .map((o) => ({
      mes: num(o.mes),
      linha: o.linha,
      // `limpar` distingue "célula vazia" de "célula forçada a zero".
      limpar: bool(o.limpar),
      valor: bool(o.limpar) ? null : num(o.valor),
    }));
}

/**
 * Monta o `ModelInput` a partir da linha carregada.
 *
 * Quando a modelagem ainda não tem financiamento ou receita gravados (não deveria
 * acontecer, as duas linhas nascem com a modelagem), o mapeador devolve padrões
 * neutros em vez de estourar: o motor não pode falhar por input incompleto.
 */
export function mapearModelInput(linha: LinhaModelagem): ModelInput {
  const fin = linha.financiamento ?? {};
  const rec = linha.receita ?? {};
  const unidades = mapearUnidades(linha.unidades);
  const fases = mapearFases(linha.fases);

  // A venda por unidade é guardada por id da unidade; o motor trabalha por índice.
  const indicePorId = new Map<number, number>();
  unidades.forEach((u, i) => {
    if (u.id != null) indicePorId.set(u.id, i);
  });
  const indicePorFaseId = new Map<number, number>();
  fases.forEach((f, i) => {
    if (f.id != null) indicePorFaseId.set(f.id, i);
  });
  const vendasPorUnidade = lista(linha.vendas_unidade)
    .map((v) => ({
      unidadeIndex: indicePorId.get(num(v.unidade_id)) ?? -1,
      mesVenda: num(v.mes_venda),
    }))
    .filter((v) => v.unidadeIndex >= 0);

  return {
    nome: texto(linha.nome),
    localizacao: texto(linha.localizacao),
    tipoUso: texto(linha.tipo_uso),
    moeda: texto(linha.moeda, 'USD'),
    dataInicio: dataIso(linha.data_inicio),
    mesesAprovacao: num(linha.meses_aprovacao),
    mesesConstrucao: num(linha.meses_construcao),
    mesesPosObra: num(linha.meses_pos_obra),
    horizonteMaximo: num(linha.horizonte_maximo, 60),
    unidades,
    custosAdicionais: mapearCustos(linha.custos),
    aportes: mapearAportes(linha.aportes, linha.aporte_parcelas),
    usaFases: bool(linha.usa_fases),
    terrenoPorFase: bool(linha.terreno_por_fase),
    fases,
    alocacoes: mapearAlocacoes(linha.unidade_fases, indicePorId, indicePorFaseId),
    financiamento: {
      taxaAnual: num(fin.taxa_anual),
      feeEstruturacaoPct: num(fin.fee_estruturacao_pct),
      feeTiming: (fin.fee_timing ?? 'first_draw') as 'first_draw' | 'contract_month',
      feeMes: inteiroOuNulo(fin.fee_mes),
      mesInicioSaque: num(fin.mes_inicio_saque, 1),
      mesFimSaque: num(fin.mes_fim_saque, 1),
      modoSaque: (fin.modo_saque ?? 'equity_first') as ModelInput['financiamento']['modoSaque'],
      maxLtcPct: numeroOuNulo(fin.max_ltc_pct),
      valorContratado: numeroOuNulo(fin.valor_contratado),
      custoFinanceiroNaDemanda: bool(fin.custo_financeiro_na_demanda),
      // 'price' e 'sac' foram removidos pela migration 1763400000, que converteu
      // as linhas gravadas em 'manual'. A tradução é repetida AQUI de propósito:
      // enquanto a migration não tiver rodado — ou numa réplica atrasada —, uma
      // linha ainda em 'price' precisa mapear para 'manual', que é exatamente o
      // resultado que ela já produzia. Cair no fallback 'at_exit' acrescentaria
      // uma quitação no mês da saída que ela nunca teve.
      modoAmortizacao: (fin.modo_amortizacao === 'price' || fin.modo_amortizacao === 'sac'
        ? 'manual'
        : MODOS_AMORTIZACAO.includes(fin.modo_amortizacao)
          ? fin.modo_amortizacao
          : 'at_exit') as ModelInput['financiamento']['modoAmortizacao'],
      capitalizarJuros: bool(fin.capitalizar_juros),
      colchaoMinimoCaixa: num(fin.colchao_minimo_caixa),
      // Ausente = FALSE, o default da coluna (migration 1763300000): toda
      // modelagem já gravada continua com a facilidade não rotativa.
      linhaRotativa: bool(fin.linha_rotativa),

      // DECIMAL(15,2) chega como STRING; sem num(), a reserva viraria texto e a
      // comparação com os juros do mês daria resultado sem sentido.
      reservaJuros: num(fin.reserva_juros),
      // Ausente = TRUE, o default da coluna (migration 1762100000).
      reservaJurosSacada: bool(fin.reserva_juros_sacada, true),

      prazoMeses: inteiroOuNulo(fin.prazo_meses),
      carenciaMeses: Math.max(0, Math.trunc(num(fin.carencia_meses))),
      amortizacaoMeses: inteiroOuNulo(fin.amortizacao_meses),
      balloonNoVencimento: bool(fin.balloon_no_vencimento, true),

      releasePrice: num(fin.release_price),
      // Nulo é diferente de zero aqui: nulo é "não usar", zero seria 0% de release.
      releasePricePct: numeroOuNulo(fin.release_price_pct),

      convencaoJuros: (CONVENCOES_JUROS.includes(fin.convencao_juros as ConvencaoJuros)
        ? fin.convencao_juros
        : 'mensal_12') as ConvencaoJuros,
      tipoTaxa: fin.tipo_taxa === 'variavel' ? 'variavel' : 'fixa',
      // DECIMAL(9,6) — mesma coerção de taxa_anual e comissao_pct.
      spread: num(fin.spread),
      benchmarkNome: fin.benchmark_nome == null ? null : String(fin.benchmark_nome),
      benchmarkPadrao: num(fin.benchmark_padrao),
      benchmarkCurva: mapearBenchmarkCurva(linha.benchmark_curva),
    },
    socios: mapearSocios(linha.socios),
    receita: {
      comissaoPct: num(rec.comissao_pct),
      custoCartorioPct: num(rec.custo_cartorio_pct),
      modoVenda: (rec.modo_venda ?? 'single_exit') as ModelInput['receita']['modoVenda'],
      mesSaida: inteiroOuNulo(rec.mes_saida),
      lucroInvestidoresPct: num(rec.lucro_investidores_pct, 0.8),
      lucroSponsorPct: num(rec.lucro_sponsor_pct, 0.2),
      vendasPorUnidade,
      takedowns: mapearTakedowns(linha.takedowns, indicePorId, indicePorFaseId),
    },
    overrides: mapearOverrides(linha.overrides),
  };
}
