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
  BaseCalculoCusto,
  CategoriaCusto,
  CustoAdicional,
  Fase,
  ModelInput,
  Override,
  PlanoAportes,
  Socio,
  Unidade,
} from './tipos';
import { BASES_CALCULO_CUSTO, CATEGORIAS_CUSTO, LINHAS_FLUXO } from './tipos';

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
  }));
}

export function mapearSocios(linhas: unknown): Socio[] {
  return lista(linhas).map((s) => ({
    id: num(s.id) || undefined,
    nome: texto(s.nome),
    participacaoPct: num(s.participacao_pct),
    cotaDisponivel: bool(s.cota_disponivel),
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
      modoAmortizacao: (fin.modo_amortizacao ?? 'at_exit') as 'at_exit' | 'manual',
      capitalizarJuros: bool(fin.capitalizar_juros),
      colchaoMinimoCaixa: num(fin.colchao_minimo_caixa),
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
    },
    overrides: mapearOverrides(linha.overrides),
  };
}
