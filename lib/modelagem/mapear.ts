/**
 * Ponte entre as linhas do banco e o `ModelInput` do motor.
 *
 * Existe por um motivo específico: as colunas DECIMAL do Postgres chegam ao
 * cliente como STRING. Sem coerção explícita, `custo_terreno + custo_obra` vira
 * concatenação de texto e o modelo inteiro sai errado sem lançar erro nenhum.
 */
import type { CustoAdicional, ModelInput, Override, PlanoAportes, Socio, Unidade } from './tipos';
import { LINHAS_FLUXO } from './tipos';

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

/**
 * Cabeçalho do plano de aportes (`modelagem_aportes`, uma linha por modelagem).
 *
 * Devolve `undefined` quando não há linha — nesse caso o motor usa 0, que é o
 * mesmo que a antiga soma dos aportes base dava sem unidade nenhuma.
 */
export function mapearAportes(linha: unknown): PlanoAportes | undefined {
  if (!linha || typeof linha !== 'object') return undefined;
  const a = linha as Record<string, unknown>;
  return {
    modoAporte: (a.modo_aporte ?? 'demanda') as PlanoAportes['modoAporte'],
    aporteBaseTotal: num(a.aporte_base_total),
    valorTotalAlvo: num(a.valor_total_alvo),
  };
}

export function mapearCustos(linhas: unknown): CustoAdicional[] {
  return lista(linhas).map((c) => ({
    id: num(c.id) || undefined,
    label: texto(c.label),
    valor: num(c.valor),
    distribuicao: (c.distribuicao ?? 'linear_construction') as CustoAdicional['distribuicao'],
    mesAncora: inteiroOuNulo(c.mes_ancora),
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

  // A venda por unidade é guardada por id da unidade; o motor trabalha por índice.
  const indicePorId = new Map<number, number>();
  unidades.forEach((u, i) => {
    if (u.id != null) indicePorId.set(u.id, i);
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
    aportes: mapearAportes(linha.aportes),
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
