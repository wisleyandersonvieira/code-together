/**
 * Planilha Excel da modelagem financeira.
 *
 * Tudo aqui lê o `ModelOutput` — nenhum número é recalculado. As fórmulas que a
 * planilha carrega existem para ela se auditar sozinha (SUM de linha, SUM de
 * coluna, percentuais sobre células da própria aba); o motor nunca é
 * reimplementado em célula.
 *
 * `exceljs` entra por import dinâmico: são ~900 kB que só quem exporta paga.
 */
import type { Alignment, Fill, Font, Workbook, Worksheet } from 'exceljs';
import {
  basesDeCalculo,
  CATEGORIAS_CUSTO,
  gradeSensibilidade,
  pontosDeEquilibrio,
  resolverCustos,
  ROTULO_CATEGORIA,
  ROTULO_GATILHO,
  sensibilidadePrazo,
  SUFIXO_BASE_CALCULO,
  VARIACOES_CUSTO,
  VARIACOES_PRECO,
} from '@/lib/modelagem';
import type { LinhaFluxo, MesFluxo, ModelInput, ModelOutput, Semaforo } from '@/lib/modelagem';
import { nomeArquivoModelagem } from './exportarPdf';

// ─── Tokens de design ───────────────────────────────────────────────────────

const T = {
  navy:      'FF0F2E4C', // título de aba, texto de destaque
  azul:      'FF1C4E7A', // header de tabela (texto branco)
  faixa:     'FFEDF1F6', // barra de seção e linha de total
  cardCinza: 'FFF7F9FC', // card de KPI
  cardCreme: 'FFFDF6E7', // card de KPI de retorno
  cinza:     'FF5A6875', // label e texto secundário
  azulClaro: 'FFD6E2EE', // subtítulo sobre o navy
  dourado:   'FFB98B2E', // valores de retorno
  texto:     'FF1A1A1A', // texto padrão
  entrada:   'FF008000', // valor de origem/input
  branco:    'FFFFFFFF',
  verdeClaro:'FFE8F5E9', // linha de conferência verde
  rosaClaro: 'FFFDECEA', // linha de conferência vermelha
};

/** Formato do dinheiro deriva da moeda da modelagem — nada de `$` fixo. */
const fmtMoeda = (m: string) => m === 'BRL'
  ? 'R$\\ #,##0;"(R$\\ "#,##0")";\\–'
  : '\\$#,##0;"($"#,##0\\);\\–';
const FMT_INT   = '#,##0;\\(#,##0\\);\\–';
const FMT_PCT   = '0.0%;\\(0.0%\\);\\–';
const FMT_PCT2  = '0.00%;\\(0.00%\\);\\–';
const FMT_MULT  = '0.00\\x';
const FMT_MES   = 'mmm/yyyy';

const fonte = (o: Partial<Font> = {}): Partial<Font> => ({ name: 'Arial', size: 10, ...o });
const fundo = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const esq: Partial<Alignment> = { horizontal: 'left', vertical: 'middle', indent: 1 };
const dir: Partial<Alignment> = { horizontal: 'right', vertical: 'middle' };
const centro: Partial<Alignment> = { horizontal: 'center', vertical: 'middle' };

const ROTULO_SAQUE: Record<string, string> = {
  equity_first: 'Equity primeiro', cash_demand: 'Demanda de caixa', manual: 'Manual',
};
const ROTULO_AMORTIZACAO: Record<string, string> = { at_exit: 'Integral na saída', manual: 'Manual' };
const ROTULO_VENDA: Record<string, string> = {
  single_exit: 'Venda única na saída', per_unit: 'Por unidade', manual: 'Manual',
};
const ROTULO_APORTE: Record<string, string> = {
  demanda: 'Por demanda de caixa', plano: 'Plano de aportes',
};
const ROTULO_SEMAFORO: Record<Semaforo, string> = {
  verde: 'Verde', ambar: 'Âmbar', vermelho: 'Vermelho',
};

/** Linhas do fluxo, na ordem exata de `AbaFluxoCaixa` (constante LINHAS). */
interface DefinicaoLinha {
  chave: string;
  rotulo: string;
  valor: (m: MesFluxo) => number;
  linha?: LinhaFluxo;
  destaque?: boolean;
  separador?: boolean;
  somavel?: boolean;
}

const LINHAS: DefinicaoLinha[] = [
  { chave: 'land', rotulo: 'Terrenos', valor: (m) => m.land, linha: 'land' },
  { chave: 'construction', rotulo: 'Obra', valor: (m) => m.construction, linha: 'construction' },
  { chave: 'property_tax', rotulo: 'Property taxes', valor: (m) => m.propertyTax, linha: 'property_tax' },
  { chave: 'other_costs', rotulo: 'Outros custos', valor: (m) => m.otherCosts, linha: 'other_costs' },
  { chave: 'custo_fin', rotulo: 'Juros e taxas', valor: (m) => m.custoFinanceiroCaixa },
  { chave: 'pagamentos', rotulo: 'Total de pagamentos', valor: (m) => m.pagamentos, destaque: true },
  { chave: 'revenue', rotulo: 'Receita', valor: (m) => m.revenue, linha: 'revenue', separador: true },
  { chave: 'draw', rotulo: 'Saque', valor: (m) => m.draw, linha: 'draw' },
  { chave: 'amortization', rotulo: 'Amortização', valor: (m) => m.amortization, linha: 'amortization' },
  { chave: 'equity_call', rotulo: 'Aporte de equity', valor: (m) => m.equityCall, linha: 'equity_call', destaque: true },
  { chave: 'distribution', rotulo: 'Distribuição', valor: (m) => m.distribution, linha: 'distribution' },
  { chave: 'saldo', rotulo: 'Saldo devedor', valor: (m) => m.saldoDevedor, separador: true, somavel: false },
  { chave: 'equity_ac', rotulo: 'Equity acumulado', valor: (m) => m.equityAcumulado, somavel: false },
  { chave: 'caixa_mes', rotulo: 'Caixa do mês', valor: (m) => m.caixaMes },
  { chave: 'caixa_ac', rotulo: 'Caixa acumulado', valor: (m) => m.caixaAcumulado, destaque: true, somavel: false },
];

// ─── Primitivas de layout ───────────────────────────────────────────────────

/** 'YYYY-MM-DD' → Date local do dia 1. Local de propósito: é assim que o
 *  exceljs converte para serial do Excel sem deslocar o mês. */
function dataDoMes(iso: string): Date | null {
  const [ano, mes] = String(iso).split('-').map(Number);
  if (!ano || !mes) return null;
  return new Date(ano, mes - 1, 1);
}

const letra = (ws: Worksheet, coluna: number) => ws.getColumn(coluna).letter;

/**
 * Coluna A com largura 2 faz a margem: todo conteúdo começa em B. É o que dá o
 * respiro do modelo.
 */
function novaAba(wb: Workbook, nome: string, larguras: number[]): Worksheet {
  const ws = wb.addWorksheet(nome);
  ws.columns = [{ width: 2 }, ...larguras.map((w) => ({ width: w }))];
  return ws;
}

interface OpcoesFaixa {
  fill?: Fill;
  font?: Partial<Font>;
  altura?: number;
  alinhamento?: Partial<Alignment>;
}

/**
 * Escreve numa faixa mesclada. O preenchimento é aplicado célula a célula ANTES
 * da mesclagem: o Excel não propaga o estilo do canto para o resto do bloco.
 */
function faixa(ws: Worksheet, linha: number, de: number, ate: number, texto: string, o: OpcoesFaixa = {}) {
  for (let c = de; c <= ate; c++) {
    const cel = ws.getCell(linha, c);
    if (o.fill) cel.fill = o.fill;
    cel.font = o.font ?? fonte();
  }
  const mestre = ws.getCell(linha, de);
  mestre.value = texto;
  mestre.alignment = o.alinhamento ?? esq;
  if (ate > de) ws.mergeCells(linha, de, linha, ate);
  if (o.altura) ws.getRow(linha).height = o.altura;
}

function tituloAba(ws: Worksheet, linha: number, de: number, ate: number, titulo: string, subtitulo?: string) {
  faixa(ws, linha, de, ate, titulo, {
    fill: fundo(T.navy),
    font: fonte({ size: 14, bold: true, color: { argb: T.branco } }),
    altura: 26,
  });
  if (subtitulo !== undefined) {
    faixa(ws, linha + 1, de, ate, subtitulo, {
      fill: fundo(T.navy),
      font: fonte({ size: 9, color: { argb: T.azulClaro } }),
      altura: 16,
    });
  }
}

function barraSecao(ws: Worksheet, linha: number, de: number, ate: number, texto: string) {
  faixa(ws, linha, de, ate, texto.toUpperCase(), {
    fill: fundo(T.faixa),
    font: fonte({ size: 10, bold: true, color: { argb: T.navy } }),
    altura: 20,
  });
}

interface ColunaAba { titulo: string; align?: 'left' | 'right' | 'center' }

function cabecalhoTabela(ws: Worksheet, linha: number, de: number, colunas: ColunaAba[]) {
  colunas.forEach((col, i) => {
    const cel = ws.getCell(linha, de + i);
    cel.value = col.titulo;
    cel.fill = fundo(T.azul);
    cel.font = fonte({ size: 9, bold: true, color: { argb: T.branco } });
    cel.alignment = {
      horizontal: col.align ?? 'left',
      vertical: 'middle',
      wrapText: true,
      ...(col.align === 'left' || !col.align ? { indent: 1 } : {}),
    };
  });
  ws.getRow(linha).height = 22;
}

/** Fill faixa + navy negrito + borda superior azul. */
function estiloTotal(ws: Worksheet, linha: number, de: number, ate: number) {
  for (let c = de; c <= ate; c++) {
    const cel = ws.getCell(linha, c);
    cel.fill = fundo(T.faixa);
    cel.font = fonte({ ...(cel.font ?? {}), bold: true, color: { argb: T.navy } });
    cel.border = { ...(cel.border ?? {}), top: { style: 'thin', color: { argb: T.azul } } };
  }
}

function bordaSuperior(ws: Worksheet, linha: number, de: number, ate: number) {
  for (let c = de; c <= ate; c++) {
    const cel = ws.getCell(linha, c);
    cel.border = { ...(cel.border ?? {}), top: { style: 'thin', color: { argb: T.azulClaro } } };
  }
}

interface OpcoesCard { creme?: boolean; numFmt?: string }

/** Label 8pt cinza + valor 16pt logo abaixo, ambos mesclados em 2 colunas. */
function card(ws: Worksheet, linha: number, coluna: number, label: string, valor: number | string, o: OpcoesCard = {}) {
  const fill = fundo(o.creme ? T.cardCreme : T.cardCinza);
  faixa(ws, linha, coluna, coluna + 1, label.toUpperCase(), {
    fill,
    font: fonte({ size: 8, bold: true, color: { argb: T.cinza } }),
    altura: 15,
  });
  for (let c = coluna; c <= coluna + 1; c++) ws.getCell(linha + 1, c).fill = fill;
  const cel = ws.getCell(linha + 1, coluna);
  cel.value = valor;
  if (o.numFmt) cel.numFmt = o.numFmt;
  cel.font = fonte({ size: 16, bold: true, color: { argb: o.creme ? T.dourado : T.navy } });
  cel.alignment = esq;
  ws.mergeCells(linha + 1, coluna, linha + 1, coluna + 1);
  ws.getRow(linha + 1).height = 24;
}

/** Par rótulo/valor. Marca em verde o que é premissa digitada pelo usuário. */
function par(
  ws: Worksheet,
  linha: number,
  coluna: number,
  rotulo: string,
  valor: number | string | Date | null,
  o: { numFmt?: string; entrada?: boolean; nota?: string } = {},
) {
  const r = ws.getCell(linha, coluna);
  r.value = rotulo;
  r.font = fonte({ color: { argb: T.cinza } });
  r.alignment = esq;
  const v = ws.getCell(linha, coluna + 1);
  v.value = valor === null ? '–' : valor;
  if (o.numFmt && valor !== null) v.numFmt = o.numFmt;
  v.font = fonte({ bold: true, color: { argb: o.entrada ? T.entrada : T.texto } });
  v.alignment = typeof valor === 'number' ? dir : esq;
  if (o.nota) {
    const n = ws.getCell(linha, coluna + 2);
    n.value = o.nota;
    n.font = fonte({ size: 8, color: { argb: T.cinza } });
    n.alignment = esq;
  }
}

function nota(ws: Worksheet, linha: number, de: number, ate: number, texto: string) {
  faixa(ws, linha, de, ate, texto, { font: fonte({ size: 8, color: { argb: T.cinza } }) });
}

// ─── Construção do workbook ─────────────────────────────────────────────────

export async function construirWorkbookModelagem(input: ModelInput, resultado: ModelOutput): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = 'Provision';
  wb.created = new Date();

  const moeda = input.moeda ?? 'USD';
  const MOEDA = fmtMoeda(moeda);
  const { apuracao: ap, indicadores: ind, agregados: ag, cronograma: cr, meses } = resultado;
  const nome = input.nome || 'Modelagem sem nome';
  const temQuantidade = input.unidades.some((u) => u.quantidade !== undefined && u.quantidade !== null);
  const usaFases = !!input.usaFases && (input.fases?.length ?? 0) > 0 && cr.fases.length > 0;
  const plano = input.aportes;

  abaSumario();
  abaPremissas();
  abaTipologias();
  abaUsosFontes();
  abaFluxo();
  abaAportes();
  abaJuros();
  abaInvestidores();
  abaRetorno();
  abaSensibilidade();
  abaConferencias();

  return wb;

  // ── 1 · Sumário Executivo ─────────────────────────────────────────────────
  function abaSumario() {
    const ws = novaAba(wb, 'Sumário Executivo', [26, 18, 2, 26, 18, 2, 26, 18]);
    const ULT = 9; // coluna I
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  SUMÁRIO EXECUTIVO`,
      [input.localizacao, input.tipoUso, moeda].filter(Boolean).join('  ·  '));

    let l = 4;
    barraSecao(ws, l, 2, ULT, 'Indicadores-chave');
    l += 1;

    const trio = (
      linha: number,
      itens: [string, number | string, string | undefined][],
      creme = false,
    ) => {
      itens.forEach(([label, valor, fmt], i) => card(ws, linha, 2 + i * 3, label, valor, { creme, numFmt: fmt }));
    };

    trio(l, [
      ['Total de pagamentos', ap.totalPagamentos, MOEDA],
      ['Equity aportado', ap.equityTotal, MOEDA],
      ['Dívida sacada', ap.dividaSacada, MOEDA],
    ]);
    l += 3;
    trio(l, [
      ['VGV', ag.vgv, MOEDA],
      ['Lucro do projeto', ap.lucroProjeto, MOEDA],
      ['Lucro dos investidores', ap.lucroInvestidores, MOEDA],
    ]);
    l += 3;
    trio(l, [
      ['MOIC', ind.moic ?? '–', ind.moic == null ? undefined : FMT_MULT],
      ['TIR a.a.', ind.tirAnual ?? '–', ind.tirAnual == null ? undefined : FMT_PCT],
      ['Prazo até a saída', `${cr.mesSaida} meses`, undefined],
    ], true);
    l += 3;

    barraSecao(ws, l, 2, ULT, 'Modo de operação do fluxo');
    l += 1;
    par(ws, l, 2, 'Saque', ROTULO_SAQUE[input.financiamento.modoSaque] ?? input.financiamento.modoSaque, { entrada: true });
    par(ws, l, 5, 'Amortização', ROTULO_AMORTIZACAO[input.financiamento.modoAmortizacao] ?? input.financiamento.modoAmortizacao, { entrada: true });
    par(ws, l, 8, 'Venda', ROTULO_VENDA[input.receita.modoVenda] ?? input.receita.modoVenda, { entrada: true });
    l += 1;
    par(ws, l, 2, 'Aporte', plano ? (ROTULO_APORTE[plano.modoAporte] ?? plano.modoAporte) : 'Por demanda de caixa', { entrada: true });
    par(ws, l, 5, 'Capitalização de juros', input.financiamento.capitalizarJuros ? 'Sim' : 'Não', { entrada: true });
    par(ws, l, 8, 'Fases', usaFases ? `${cr.fases.length} fase(s)` : 'Frente única', { entrada: true });
    l += 2;

    const blocos: [string, number, [string, number | string, string | undefined][]][] = [
      ['O ativo', 2, [
        ['Unidades', ag.unidadesTotal, FMT_INT],
        ['Área total (sf)', input.unidades.reduce((a, u) => a + (u.areaSf || 0) * Math.max(1, Math.trunc(u.quantidade || 1)), 0), FMT_INT],
        ['Terrenos', ag.terrenosTotal, MOEDA],
        ['Obra', ag.obraTotal, MOEDA],
        ['Custo do empreendimento', ap.custoEmpreendimento, MOEDA],
      ]],
      ['A receita', 5, [
        ['VGV', ag.vgv, MOEDA],
        ['Comissões', ap.comissoes, MOEDA],
        ['Cartório / closing', ap.cartorio, MOEDA],
        ['Receita líquida', ap.receitaLiquida, MOEDA],
        ['Preço médio por unidade', ag.unidadesTotal ? ag.vgv / ag.unidadesTotal : 0, MOEDA],
      ]],
      ['O retorno', 8, [
        ['Lucro do projeto', ap.lucroProjeto, MOEDA],
        ['Margem sobre VGV', ind.margemVgv ?? '–', ind.margemVgv == null ? undefined : FMT_PCT],
        ['MOIC', ind.moic ?? '–', ind.moic == null ? undefined : FMT_MULT],
        ['TIR a.a.', ind.tirAnual ?? '–', ind.tirAnual == null ? undefined : FMT_PCT],
        ['Equity aportado', ap.equityTotal, MOEDA],
      ]],
    ];
    for (const [titulo, coluna, itens] of blocos) {
      barraSecao(ws, l, coluna, coluna + 1, titulo);
      itens.forEach(([rotulo, valor, fmt], i) => par(ws, l + 1 + i, coluna, rotulo, valor, { numFmt: fmt }));
    }
    l += 7;

    nota(ws, l, 2, ULT,
      'Este material não constitui oferta de investimento. Os valores são projeções baseadas nas premissas informadas e não representam garantia de resultado.');

    ws.views = [{ showGridLines: false }];
  }

  // ── 2 · Premissas ─────────────────────────────────────────────────────────
  function abaPremissas() {
    const ws = novaAba(wb, 'Premissas', [38, 20, 20, 20, 20, 20, 20]);
    const ULT = 8;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  PREMISSAS`,
      'Os valores em verde são premissas digitadas; tudo o mais é derivado pelo motor.');
    let l = 4;

    barraSecao(ws, l++, 2, ULT, 'Identificação');
    par(ws, l++, 2, 'Modelagem', nome, { entrada: true });
    par(ws, l++, 2, 'Localização', input.localizacao || '–', { entrada: true });
    par(ws, l++, 2, 'Tipo de uso', input.tipoUso || '–', { entrada: true });
    par(ws, l++, 2, 'Moeda', moeda, { entrada: true });
    l += 1;

    barraSecao(ws, l++, 2, ULT, 'Cronograma');
    const d1 = dataDoMes(cr.dataInicio);
    par(ws, l++, 2, 'Data do mês 1', d1 ?? cr.dataInicio, { numFmt: FMT_MES, entrada: true });
    par(ws, l++, 2, 'Meses de aprovação', input.mesesAprovacao, { numFmt: FMT_INT, entrada: true });
    par(ws, l++, 2, 'Meses de construção', input.mesesConstrucao, { numFmt: FMT_INT, entrada: true });
    par(ws, l++, 2, 'Meses de pós-obra', input.mesesPosObra, { numFmt: FMT_INT, entrada: true });
    par(ws, l++, 2, 'Horizonte máximo', cr.horizonteMaximo, { numFmt: FMT_INT });
    par(ws, l++, 2, 'Prazo total', cr.prazoTotal, { numFmt: FMT_INT, nota: 'derivado' });
    par(ws, l++, 2, 'Início da obra', cr.mesInicioObra, { numFmt: FMT_INT, nota: cr.dataInicioObra });
    par(ws, l++, 2, 'Fim da obra', cr.mesFimObra, { numFmt: FMT_INT, nota: cr.dataFimObra });
    par(ws, l++, 2, 'Mês de saída', cr.mesSaida, { numFmt: FMT_INT, nota: cr.dataSaida });
    if (usaFases) {
      l += 1;
      cabecalhoTabela(ws, l++, 2, [
        { titulo: 'Fase' }, { titulo: 'Data início', align: 'center' }, { titulo: 'Data fim', align: 'center' },
        { titulo: 'Mês início', align: 'right' }, { titulo: 'Mês fim', align: 'right' }, { titulo: 'Duração', align: 'right' },
      ]);
      for (const f of cr.fases) {
        const linha = ws.getRow(l);
        [f.nome, f.dataInicio, f.dataFim, f.mesInicio, f.mesFim, f.mesFim - f.mesInicio + 1]
          .forEach((v, i) => {
            const cel = linha.getCell(2 + i);
            cel.value = v as never;
            cel.font = fonte();
            cel.alignment = i === 0 ? esq : i <= 2 ? centro : dir;
            if (i >= 3) cel.numFmt = FMT_INT;
          });
        l++;
      }
    }
    l += 1;

    barraSecao(ws, l++, 2, ULT, 'Unidades');
    cabecalhoTabela(ws, l++, 2, [
      { titulo: 'Tipologia' }, { titulo: 'Cidade' }, { titulo: 'Qtd', align: 'right' },
      { titulo: 'Área sf (un)', align: 'right' }, { titulo: 'Terreno (un)', align: 'right' },
      { titulo: 'Obra (un)', align: 'right' }, { titulo: 'Preço de venda (un)', align: 'right' },
    ]);
    input.unidades.forEach((u, i) => {
      const linha = ws.getRow(l++);
      const valores: (string | number)[] = [
        u.nome || `Tipologia ${i + 1}`, u.cidade || '–',
        Math.max(1, Math.trunc(u.quantidade || 1)), u.areaSf ?? 0,
        u.custoTerreno, u.custoObra, u.precoVenda,
      ];
      valores.forEach((v, k) => {
        const cel = linha.getCell(2 + k);
        cel.value = v;
        cel.font = fonte({ color: { argb: T.entrada } });
        cel.alignment = k <= 1 ? esq : dir;
        if (k === 2 || k === 3) cel.numFmt = FMT_INT;
        if (k >= 4) cel.numFmt = MOEDA;
      });
    });
    l += 1;

    barraSecao(ws, l++, 2, ULT, 'Orçamento');
    const custos = input.custosAdicionais ?? [];
    if (custos.length === 0) {
      nota(ws, l++, 2, ULT, 'Nenhum custo adicional cadastrado.');
    } else {
      cabecalhoTabela(ws, l++, 2, [
        { titulo: 'Custo adicional' }, { titulo: 'Categoria' }, { titulo: 'Base' },
        { titulo: 'Valor', align: 'right' }, { titulo: 'Gatilho' },
        { titulo: 'Distribuição' }, { titulo: 'Mês âncora', align: 'right' },
      ]);
      // Mesmas funções puras do motor — inclusive a poda de referência circular:
      // a planilha não tem conta própria.
      const basesCusto = basesDeCalculo(input.unidades ?? []);
      const resolucaoCusto = resolverCustos(custos, basesCusto, {
        terreno: ag.terrenosTotal,
        vertical: ag.obraTotal,
      });
      // Índice do custo dentro de `custos`, que é a MESMA ordem de
      // `resolucaoCusto.valores`. O agrupamento por categoria abaixo reordena a
      // leitura, então o índice precisa viajar junto com a linha.
      const comIndice = custos.map((c, i) => ({ c, i }));
      // Agrupado por categoria, e dentro dela na ordem em que o usuário cadastrou
      // — a mesma leitura da aba Orçamento na tela.
      //
      // Os subtotais saem de `agregados.custosPorCategoria`: o motor é quem soma,
      // aqui só se lê. Se a planilha divergir da tela, é bug de leitura.
      for (const categoria of CATEGORIAS_CUSTO) {
        const doGrupo = comIndice.filter((x) => x.c.categoria === categoria);
        if (doGrupo.length === 0) continue;
        for (const { c, i } of doGrupo) {
          const linha = ws.getRow(l++);
          const valores: (string | number)[] = [
            // Filho de outra linha entra recuado, igual à indentação da tela.
            (c.grupoPaiId != null ? '    ' : '') + c.label,
            ROTULO_CATEGORIA[categoria],
            // Numa base derivada, a coluna Valor traz o TOTAL efetivo e esta
            // coluna mostra de onde ele veio. `c.valor` não é lido: com base
            // <> 'total' ele guarda só o último total digitado.
            c.baseCalculo === 'total'
              ? 'Valor total'
              : c.baseCalculo === 'pct_de_grupo'
                ? `${(c.percentual * 100).toFixed(2)}% de ${ROTULO_CATEGORIA[c.grupoReferencia ?? 'outros']}`
                : `${c.valorUnitario}${SUFIXO_BASE_CALCULO[c.baseCalculo]}`,
            resolucaoCusto.valores[i] ?? 0,
            ROTULO_GATILHO[c.gatilho] ?? c.gatilho,
            // Fora de 'cronograma' o gatilho substitui a distribuição; dizer isso
            // evita que quem lê a planilha atribua o mês à coluna errada.
            c.gatilho === 'cronograma' ? c.distribuicao : '–',
            c.mesAncora ?? '–',
          ];
          valores.forEach((v, k) => {
            const cel = linha.getCell(2 + k);
            cel.value = v;
            cel.font = fonte({ color: { argb: T.entrada } });
            cel.alignment = k === 0 || k === 1 || k === 2 || k === 4 || k === 5 ? esq : dir;
            if (k === 3) cel.numFmt = MOEDA;
          });
        }
        const subtotal = ws.getRow(l);
        subtotal.getCell(2).value = `Subtotal — ${ROTULO_CATEGORIA[categoria]}`;
        subtotal.getCell(2).alignment = esq;
        subtotal.getCell(5).value = ag.custosPorCategoria[categoria];
        subtotal.getCell(5).numFmt = MOEDA;
        subtotal.getCell(5).alignment = dir;
        bordaSuperior(ws, l, 2, 8);
        l += 1;
      }
      const total = ws.getRow(l);
      total.getCell(2).value = 'Total do orçamento';
      total.getCell(2).alignment = esq;
      total.getCell(5).value = resolucaoCusto.valores.reduce((a, v) => a + v, 0);
      total.getCell(5).numFmt = MOEDA;
      total.getCell(5).alignment = dir;
      estiloTotal(ws, l, 2, 8);
      l += 1;
    }
    l += 1;

    barraSecao(ws, l++, 2, ULT, 'Financiamento');
    const fin = input.financiamento;
    par(ws, l++, 2, 'Taxa ao ano', fin.taxaAnual, { numFmt: FMT_PCT2, entrada: true });
    par(ws, l++, 2, 'Fee de estruturação', fin.feeEstruturacaoPct, { numFmt: FMT_PCT2, entrada: true });
    par(ws, l++, 2, 'Momento do fee', fin.feeTiming === 'first_draw' ? 'No primeiro saque' : `Mês ${fin.feeMes ?? '–'}`, { entrada: true });
    par(ws, l++, 2, 'Início da janela de saque', fin.mesInicioSaque, { numFmt: FMT_INT, entrada: true });
    par(ws, l++, 2, 'Fim da janela de saque', fin.mesFimSaque, { numFmt: FMT_INT, entrada: true });
    par(ws, l++, 2, 'Modo de saque', ROTULO_SAQUE[fin.modoSaque] ?? fin.modoSaque, { entrada: true });
    if (fin.valorContratado != null) {
      par(ws, l++, 2, 'Valor contratado', fin.valorContratado, { numFmt: MOEDA, entrada: true });
    } else if (fin.maxLtcPct != null) {
      par(ws, l++, 2, 'Teto por LTC', fin.maxLtcPct, { numFmt: FMT_PCT, entrada: true });
    } else {
      par(ws, l++, 2, 'Teto de dívida', 'sem teto declarado', { entrada: true });
    }
    par(ws, l++, 2, 'Teto de dívida aplicado', ap.tetoDivida, { numFmt: MOEDA, nota: 'derivado' });
    par(ws, l++, 2, 'Custo financeiro na demanda', fin.custoFinanceiroNaDemanda ? 'Sim' : 'Não', { entrada: true });
    par(ws, l++, 2, 'Modo de amortização', ROTULO_AMORTIZACAO[fin.modoAmortizacao] ?? fin.modoAmortizacao, { entrada: true });
    par(ws, l++, 2, 'Capitalização de juros', fin.capitalizarJuros ? 'Sim' : 'Não', { entrada: true });
    par(ws, l++, 2, 'Colchão mínimo de caixa', fin.colchaoMinimoCaixa, { numFmt: MOEDA, entrada: true });
    l += 1;

    barraSecao(ws, l++, 2, ULT, 'Receita');
    const rec = input.receita;
    par(ws, l++, 2, 'Comissão', rec.comissaoPct, { numFmt: FMT_PCT2, entrada: true });
    par(ws, l++, 2, 'Cartório / closing', rec.custoCartorioPct, { numFmt: FMT_PCT2, entrada: true });
    par(ws, l++, 2, 'Modo de venda', ROTULO_VENDA[rec.modoVenda] ?? rec.modoVenda, { entrada: true });
    par(ws, l++, 2, 'Mês de saída', rec.mesSaida ?? cr.prazoTotal, { numFmt: FMT_INT, entrada: true });
    par(ws, l++, 2, 'Split investidores', rec.lucroInvestidoresPct, { numFmt: FMT_PCT2, entrada: true });
    par(ws, l++, 2, 'Split sponsor', rec.lucroSponsorPct, { numFmt: FMT_PCT2, entrada: true });
    if (plano) {
      par(ws, l++, 2, 'Modo de aporte', ROTULO_APORTE[plano.modoAporte] ?? plano.modoAporte, { entrada: true });
      par(ws, l++, 2, 'Aporte base total', plano.aporteBaseTotal, { numFmt: MOEDA, entrada: true });
      par(ws, l++, 2, 'Valor total alvo', plano.valorTotalAlvo, { numFmt: MOEDA, entrada: true });
      par(ws, l++, 2, 'Planejado (soma das parcelas)', ag.aportePlanejadoTotal, { numFmt: MOEDA, nota: 'derivado' });
    }
    l += 1;

    barraSecao(ws, l++, 2, ULT, 'Sócios');
    cabecalhoTabela(ws, l++, 2, [
      { titulo: 'Sócio' }, { titulo: 'Participação', align: 'right' }, { titulo: 'Cota disponível', align: 'center' },
    ]);
    for (const s of input.socios ?? []) {
      const linha = ws.getRow(l++);
      linha.getCell(2).value = s.nome;
      linha.getCell(2).font = fonte({ color: { argb: T.entrada } });
      linha.getCell(2).alignment = esq;
      linha.getCell(3).value = s.participacaoPct;
      linha.getCell(3).numFmt = FMT_PCT2;
      linha.getCell(3).font = fonte({ color: { argb: T.entrada } });
      linha.getCell(3).alignment = dir;
      linha.getCell(4).value = s.cotaDisponivel ? 'Sim' : 'Não';
      linha.getCell(4).font = fonte({ color: { argb: s.cotaDisponivel ? T.dourado : T.cinza }, bold: s.cotaDisponivel });
      linha.getCell(4).alignment = centro;
    }

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3, showGridLines: false }];
  }

  // ── 3 · Tipologias ────────────────────────────────────────────────────────
  function abaTipologias() {
    const larguras = [5, 28, 18, ...(temQuantidade ? [8] : []), 12, 16, 16, 16, 16, 14, 16, 16, 16, 12];
    const ws = novaAba(wb, 'Tipologias', larguras);
    const ULT = 1 + larguras.length;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  TIPOLOGIAS`,
      'Todo valor monetário e de área é o TOTAL das unidades da tipologia.');

    const colunas: ColunaAba[] = [
      { titulo: '#', align: 'right' }, { titulo: 'Nome' }, { titulo: 'Cidade' },
      ...(temQuantidade ? [{ titulo: 'Qtd', align: 'right' as const }] : []),
      { titulo: 'Área sf', align: 'right' }, { titulo: 'Terreno', align: 'right' },
      { titulo: 'Obra', align: 'right' }, { titulo: 'Custo direto', align: 'right' },
      { titulo: 'Preço de venda', align: 'right' }, { titulo: 'Tax/ano', align: 'right' },
      { titulo: 'Custo total', align: 'right' }, { titulo: 'Receita líquida', align: 'right' },
      { titulo: 'Lucro', align: 'right' }, { titulo: 'Margem', align: 'right' },
    ];
    const HEADER = 4;
    cabecalhoTabela(ws, HEADER, 2, colunas);

    const primeira = HEADER + 1;
    input.unidades.forEach((u, i) => {
      const r = resultado.resultadoUnidades[i];
      const qtd = Math.max(1, Math.trunc(u.quantidade || 1));
      const linha = ws.getRow(primeira + i);
      const valores: (string | number)[] = [
        i + 1, u.nome || `Tipologia ${i + 1}`, u.cidade || '–',
        ...(temQuantidade ? [qtd] : []),
        (u.areaSf || 0) * qtd,
        (u.custoTerreno || 0) * qtd,
        (u.custoObra || 0) * qtd,
        r?.custoDireto ?? 0,
        (u.precoVenda || 0) * qtd,
        (u.propertyTaxAno || 0) * qtd,
        r?.custoTotal ?? 0,
        r?.receitaLiquida ?? 0,
        r?.lucro ?? 0,
      ];
      valores.forEach((v, k) => {
        const cel = linha.getCell(2 + k);
        cel.value = v;
        cel.font = fonte();
        cel.alignment = k === 1 || k === 2 ? esq : dir;
      });
      const inicioMoeda = temQuantidade ? 5 : 4;
      for (let k = inicioMoeda; k < valores.length; k++) linha.getCell(2 + k).numFmt = MOEDA;
      linha.getCell(2 + inicioMoeda - 1).numFmt = FMT_INT; // área
      if (temQuantidade) linha.getCell(5).numFmt = FMT_INT; // qtd
      const colLucro = 2 + valores.length - 1;
      linha.getCell(colLucro).font = fonte({ bold: true });
      const margem = ws.getCell(primeira + i, ULT);
      // Percentual sobre células da própria aba: a planilha se audita sozinha.
      const cR = letra(ws, colLucro - 1);
      const cL = letra(ws, colLucro);
      margem.value = { formula: `IF(${cR}${primeira + i}=0,"",${cL}${primeira + i}/${cR}${primeira + i})`, date1904: false };
      margem.numFmt = FMT_PCT;
      margem.font = fonte();
      margem.alignment = dir;
    });

    const ultima = primeira + input.unidades.length - 1;
    const total = primeira + input.unidades.length;
    const rowTotal = ws.getRow(total);
    rowTotal.getCell(2).value = 'TOTAL';
    rowTotal.getCell(3).value = `${input.unidades.length} tipologia(s)`;
    rowTotal.getCell(3).alignment = esq;
    // Colunas somáveis: SUM de verdade, para quem abrir a planilha auditar.
    const primeiraSomavel = temQuantidade ? 5 : 6;
    for (let c = primeiraSomavel; c < ULT; c++) {
      const L = letra(ws, c);
      const cel = ws.getCell(total, c);
      cel.value = { formula: `SUM(${L}${primeira}:${L}${ultima})`, date1904: false };
      cel.numFmt = ws.getCell(primeira, c).numFmt;
      cel.alignment = dir;
    }
    const cRt = letra(ws, ULT - 2);
    const cLt = letra(ws, ULT - 1);
    const margemTotal = ws.getCell(total, ULT);
    margemTotal.value = { formula: `IF(${cRt}${total}=0,"",${cLt}${total}/${cRt}${total})`, date1904: false };
    margemTotal.numFmt = FMT_PCT;
    margemTotal.alignment = dir;
    estiloTotal(ws, total, 2, ULT);

    nota(ws, total + 2, 2, ULT,
      `Property tax: ${(ag.taxAnoTotal || 0) > 0 ? 'valor anual da tipologia, lançado 1/12 por mês ao longo de todo o prazo' : 'sem property tax cadastrado'}. O total do período é ${ag.propertyTaxTotal.toFixed(0)}.`);
    nota(ws, total + 3, 2, ULT,
      'Juros, fee, property tax e demais custos que não pertencem a nenhuma tipologia são rateados pro-rata pelo custo direto — por isso a soma dos lucros fecha com o lucro do projeto.');

    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: HEADER, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ── 4 · Usos e Fontes ─────────────────────────────────────────────────────
  function abaUsosFontes() {
    const ws = novaAba(wb, 'Usos e Fontes', [32, 18, 14, 16, 2, 32, 18, 14]);
    const ULT = 9;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  USOS E FONTES`,
      'Percentuais são fórmulas sobre as células desta aba.');

    const HEADER = 4;
    cabecalhoTabela(ws, HEADER, 2, [
      { titulo: 'Pagamentos do projeto' }, { titulo: 'Valor', align: 'right' },
      { titulo: '% do total', align: 'right' }, { titulo: '$/unidade', align: 'right' },
    ]);
    cabecalhoTabela(ws, HEADER, 7, [
      { titulo: 'Capital' }, { titulo: 'Valor', align: 'right' }, { titulo: '% do total', align: 'right' },
    ]);

    const pagamentos: [string, number][] = [
      ['Terrenos', ap.custoTerrenos],
      ['Obra', ap.custoObra],
      ['Property taxes', ap.custoPropertyTax],
      ['Outros custos', ap.custoOutros],
      ['Juros e fees', ap.custoFinanceiro],
    ];
    const p0 = HEADER + 1;
    const pTotal = p0 + pagamentos.length;
    const unidades = Math.max(1, ag.unidadesTotal || 1);
    pagamentos.forEach(([rotulo, valor], i) => {
      const linha = p0 + i;
      ws.getCell(linha, 2).value = rotulo;
      ws.getCell(linha, 2).alignment = esq;
      ws.getCell(linha, 3).value = valor;
      ws.getCell(linha, 3).numFmt = MOEDA;
      ws.getCell(linha, 4).value = { formula: `IF($C$${pTotal}=0,0,C${linha}/$C$${pTotal})`, date1904: false };
      ws.getCell(linha, 4).numFmt = FMT_PCT;
      ws.getCell(linha, 5).value = valor / unidades;
      ws.getCell(linha, 5).numFmt = MOEDA;
      for (let c = 2; c <= 5; c++) {
        ws.getCell(linha, c).font = fonte();
        if (c > 2) ws.getCell(linha, c).alignment = dir;
      }
    });
    ws.getCell(pTotal, 2).value = 'TOTAL DE PAGAMENTOS';
    ws.getCell(pTotal, 2).alignment = esq;
    ws.getCell(pTotal, 3).value = { formula: `SUM(C${p0}:C${pTotal - 1})`, date1904: false };
    ws.getCell(pTotal, 3).numFmt = MOEDA;
    ws.getCell(pTotal, 4).value = { formula: `IF($C$${pTotal}=0,0,C${pTotal}/$C$${pTotal})`, date1904: false };
    ws.getCell(pTotal, 4).numFmt = FMT_PCT;
    ws.getCell(pTotal, 5).value = { formula: `IF($C$${pTotal}=0,0,C${pTotal}/${unidades})`, date1904: false };
    ws.getCell(pTotal, 5).numFmt = MOEDA;
    for (let c = 3; c <= 5; c++) ws.getCell(pTotal, c).alignment = dir;
    estiloTotal(ws, pTotal, 2, 5);

    const capital: [string, number][] = [
      ['Equity aportado', ap.equityTotal],
      ['Dívida sacada', ap.dividaSacada],
    ];
    const c0 = HEADER + 1;
    const cTotal = c0 + capital.length;
    capital.forEach(([rotulo, valor], i) => {
      const linha = c0 + i;
      ws.getCell(linha, 7).value = rotulo;
      ws.getCell(linha, 7).alignment = esq;
      ws.getCell(linha, 8).value = valor;
      ws.getCell(linha, 8).numFmt = MOEDA;
      ws.getCell(linha, 9).value = { formula: `IF($H$${cTotal}=0,0,H${linha}/$H$${cTotal})`, date1904: false };
      ws.getCell(linha, 9).numFmt = FMT_PCT;
      for (let c = 7; c <= 9; c++) {
        ws.getCell(linha, c).font = fonte();
        if (c > 7) ws.getCell(linha, c).alignment = dir;
      }
    });
    ws.getCell(cTotal, 7).value = 'TOTAL DE CAPITAL';
    ws.getCell(cTotal, 7).alignment = esq;
    ws.getCell(cTotal, 8).value = { formula: `SUM(H${c0}:H${cTotal - 1})`, date1904: false };
    ws.getCell(cTotal, 8).numFmt = MOEDA;
    ws.getCell(cTotal, 9).value = { formula: `IF($H$${cTotal}=0,0,H${cTotal}/$H$${cTotal})`, date1904: false };
    ws.getCell(cTotal, 9).numFmt = FMT_PCT;
    for (let c = 8; c <= 9; c++) ws.getCell(cTotal, c).alignment = dir;
    estiloTotal(ws, cTotal, 7, 9);

    const dif = cTotal + 1;
    ws.getCell(dif, 7).value = 'Capital − pagamentos';
    ws.getCell(dif, 7).font = fonte();
    ws.getCell(dif, 7).alignment = esq;
    ws.getCell(dif, 8).value = { formula: `H${cTotal}-C${pTotal}`, date1904: false };
    ws.getCell(dif, 8).numFmt = MOEDA;
    ws.getCell(dif, 8).alignment = dir;
    nota(ws, dif + 1, 7, 9, 'A diferença é coberta pela receita de vendas.');

    const ind0 = Math.max(pTotal, dif + 1) + 2;
    barraSecao(ws, ind0, 2, ULT, 'Indicadores');
    const indicadores: [string, number | string, string | undefined][] = [
      ['MOIC', ind.moic ?? '–', ind.moic == null ? undefined : FMT_MULT],
      ['ROI', ind.roi ?? '–', ind.roi == null ? undefined : FMT_PCT],
      ['Margem sobre VGV', ind.margemVgv ?? '–', ind.margemVgv == null ? undefined : FMT_PCT],
      ['LTC', ind.ltc ?? '–', ind.ltc == null ? undefined : FMT_PCT],
      ['Alavancagem', ind.alavancagem ?? '–', ind.alavancagem == null ? undefined : FMT_PCT],
      ['Custo total da dívida', ind.custoTotalDividaPct ?? '–', ind.custoTotalDividaPct == null ? undefined : FMT_PCT],
      ['TIR mensal', ind.tirMensal ?? '–', ind.tirMensal == null ? undefined : FMT_PCT2],
      ['TIR anual', ind.tirAnual ?? '–', ind.tirAnual == null ? undefined : FMT_PCT],
      ['XIRR', ind.xirr ?? '–', ind.xirr == null ? undefined : FMT_PCT],
    ];
    indicadores.forEach(([rotulo, valor, fmt], i) => {
      const coluna = i < 5 ? 2 : 7;
      const linha = ind0 + 1 + (i < 5 ? i : i - 5);
      par(ws, linha, coluna, rotulo, valor, { numFmt: fmt });
    });

    ws.views = [{ showGridLines: false }];
  }

  // ── 5 · Fluxo de Caixa ────────────────────────────────────────────────────
  function abaFluxo() {
    const ws = novaAba(wb, 'Fluxo de Caixa', [30, ...meses.map(() => 11.5), 14]);
    const COL0 = 3;                       // primeira coluna de mês
    const COL_TOTAL = COL0 + meses.length;
    const overrides = new Set<string>();
    for (const o of input.overrides ?? []) overrides.add(`${o.mes}:${o.linha}`);

    // Duas linhas de cabeçalho — número do mês e data — congeladas com a coluna
    // de rótulos: é o que torna 60 meses navegáveis.
    cabecalhoTabela(ws, 1, 2, [
      { titulo: 'Fluxo de caixa · mês' },
      ...meses.map((m) => ({ titulo: String(m.mes), align: 'right' as const })),
      { titulo: 'Total', align: 'right' as const },
    ]);
    ws.getCell(2, 2).value = 'Data';
    ws.getCell(2, 2).fill = fundo(T.azul);
    ws.getCell(2, 2).font = fonte({ size: 9, bold: true, color: { argb: T.branco } });
    ws.getCell(2, 2).alignment = esq;
    meses.forEach((m, i) => {
      const cel = ws.getCell(2, COL0 + i);
      const data = dataDoMes(m.data);
      cel.value = data ?? m.data;
      if (data) cel.numFmt = FMT_MES;
      cel.fill = fundo(T.azul);
      cel.font = fonte({ size: 9, bold: true, color: { argb: T.branco } });
      cel.alignment = dir;
    });
    const cantoTotal = ws.getCell(2, COL_TOTAL);
    cantoTotal.value = 'do período';
    cantoTotal.fill = fundo(T.azul);
    cantoTotal.font = fonte({ size: 9, bold: true, color: { argb: T.branco } });
    cantoTotal.alignment = dir;
    ws.getRow(2).height = 18;

    const primeira = 3;
    LINHAS.forEach((def, i) => {
      const l = primeira + i;
      const rotulo = ws.getCell(l, 2);
      rotulo.value = def.rotulo;
      rotulo.alignment = esq;
      rotulo.font = fonte({ bold: !!def.destaque, color: { argb: def.destaque ? T.navy : T.texto } });
      if (def.destaque) rotulo.fill = fundo(T.faixa);

      meses.forEach((m, k) => {
        const cel = ws.getCell(l, COL0 + k);
        cel.value = def.valor(m);
        cel.numFmt = MOEDA;
        cel.alignment = dir;
        cel.font = fonte({ bold: !!def.destaque, color: { argb: def.destaque ? T.navy : T.texto } });
        if (def.destaque) cel.fill = fundo(T.faixa);
        // Célula lançada à mão: a informação tem que sobreviver à exportação.
        if (def.linha && overrides.has(`${m.mes}:${def.linha}`)) cel.fill = fundo(T.cardCreme);
      });

      const total = ws.getCell(l, COL_TOTAL);
      if (def.somavel === false) {
        // Saldo, não fluxo: somar as colunas não significaria nada.
        total.value = '–';
        total.alignment = dir;
      } else {
        const de = letra(ws, COL0);
        const ate = letra(ws, COL_TOTAL - 1);
        total.value = { formula: `SUM(${de}${l}:${ate}${l})`, date1904: false };
        total.numFmt = MOEDA;
        total.alignment = dir;
      }
      total.font = fonte({ bold: true, color: { argb: T.navy } });
      total.fill = fundo(T.faixa);
      if (def.separador) bordaSuperior(ws, l, 2, COL_TOTAL);
    });

    const fim = primeira + LINHAS.length;
    nota(ws, fim + 1, 2, COL_TOTAL,
      'Saldo devedor, Equity acumulado e Caixa acumulado não somam na coluna Total: são saldos, não fluxos.');
    nota(ws, fim + 2, 2, COL_TOTAL,
      resultado.celulasManuais > 0
        ? `Células com fundo creme foram lançadas à mão (override): ${resultado.celulasManuais} no total. As demais são calculadas pelo motor.`
        : 'Nenhuma célula em modo manual — tudo calculado pelo motor. O fundo creme marcaria os lançamentos manuais.');
    if (resultado.overridesOrfaos.length > 0) {
      nota(ws, fim + 3, 2, COL_TOTAL,
        `${resultado.overridesOrfaos.length} override(s) fora do prazo: guardados e inativos, não aparecem nesta grade.`);
    }

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ── 6 · Cronograma de Aportes ─────────────────────────────────────────────
  function abaAportes() {
    const ws = novaAba(wb, 'Cronograma de Aportes', [10, 14, 18, 14, 18, 14, 18, 18]);
    const ULT = 9;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  CRONOGRAMA DE APORTES`,
      'Todos os meses do prazo, inclusive os zerados — a curva só faz sentido inteira.');
    const HEADER = 4;
    cabecalhoTabela(ws, HEADER, 2, [
      { titulo: 'Mês', align: 'right' }, { titulo: 'Data', align: 'center' },
      { titulo: 'Aporte chamado', align: 'right' }, { titulo: '% do total', align: 'right' },
      { titulo: 'Acumulado', align: 'right' }, { titulo: '% acumulado', align: 'right' },
      { titulo: 'Saldo devedor', align: 'right' }, { titulo: 'Caixa acumulado', align: 'right' },
    ]);

    const primeira = HEADER + 1;
    const ultima = primeira + meses.length - 1;
    const totalLinha = ultima + 1;
    meses.forEach((m, i) => {
      const l = primeira + i;
      const data = dataDoMes(m.data);
      ws.getCell(l, 2).value = m.mes;
      ws.getCell(l, 2).numFmt = FMT_INT;
      ws.getCell(l, 3).value = data ?? m.data;
      if (data) ws.getCell(l, 3).numFmt = FMT_MES;
      ws.getCell(l, 3).alignment = centro;
      ws.getCell(l, 4).value = m.equityCall;
      ws.getCell(l, 4).numFmt = MOEDA;
      ws.getCell(l, 5).value = { formula: `IF($D$${totalLinha}=0,0,D${l}/$D$${totalLinha})`, date1904: false };
      ws.getCell(l, 5).numFmt = FMT_PCT;
      ws.getCell(l, 6).value = m.equityAcumulado;
      ws.getCell(l, 6).numFmt = MOEDA;
      ws.getCell(l, 7).value = { formula: `IF($D$${totalLinha}=0,0,F${l}/$D$${totalLinha})`, date1904: false };
      ws.getCell(l, 7).numFmt = FMT_PCT;
      ws.getCell(l, 8).value = m.saldoDevedor;
      ws.getCell(l, 8).numFmt = MOEDA;
      ws.getCell(l, 9).value = m.caixaAcumulado;
      ws.getCell(l, 9).numFmt = MOEDA;
      for (let c = 2; c <= ULT; c++) {
        ws.getCell(l, c).font = fonte();
        if (c !== 3) ws.getCell(l, c).alignment = dir;
      }
      if (m.equityCall > 0) ws.getCell(l, 4).font = fonte({ bold: true, color: { argb: T.navy } });
    });

    ws.getCell(totalLinha, 2).value = 'Total';
    ws.getCell(totalLinha, 2).alignment = esq;
    ws.getCell(totalLinha, 4).value = { formula: `SUM(D${primeira}:D${ultima})`, date1904: false };
    ws.getCell(totalLinha, 4).numFmt = MOEDA;
    ws.getCell(totalLinha, 4).alignment = dir;
    ws.getCell(totalLinha, 5).value = { formula: `IF($D$${totalLinha}=0,0,D${totalLinha}/$D$${totalLinha})`, date1904: false };
    ws.getCell(totalLinha, 5).numFmt = FMT_PCT;
    ws.getCell(totalLinha, 5).alignment = dir;
    estiloTotal(ws, totalLinha, 2, ULT);

    const r0 = totalLinha + 2;
    barraSecao(ws, r0, 2, ULT, 'Resumo');
    const resumo: [string, string, string][] = [
      ['Exposição máxima de caixa', `MAX(0,-MIN(I${primeira}:I${ultima}))`, MOEDA],
      ['Saldo devedor máximo', `MAX(H${primeira}:H${ultima})`, MOEDA],
      ['Caixa mínimo acumulado', `MIN(I${primeira}:I${ultima})`, MOEDA],
      ['Caixa final', `I${ultima}`, MOEDA],
      ['Meses com aporte', `COUNTIF(D${primeira}:D${ultima},">0")`, FMT_INT],
    ];
    resumo.forEach(([rotulo, formula, fmt], i) => {
      const l = r0 + 1 + i;
      ws.getCell(l, 2).value = rotulo;
      ws.getCell(l, 2).font = fonte({ color: { argb: T.cinza } });
      ws.getCell(l, 2).alignment = esq;
      ws.mergeCells(l, 2, l, 3);
      const v = ws.getCell(l, 4);
      v.value = { formula, date1904: false };
      v.numFmt = fmt;
      v.font = fonte({ bold: true, color: { argb: T.navy } });
      v.alignment = dir;
    });
    nota(ws, r0 + 7, 2, ULT, 'Todos os cinco são fórmulas sobre as colunas desta aba — nada foi pré-calculado aqui.');

    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: HEADER, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ── 7 · Juros e Financiamento ─────────────────────────────────────────────
  function abaJuros() {
    const ws = novaAba(wb, 'Juros e Financiamento', [10, 18, 16, 16, 14, 16, 18, 20]);
    const ULT = 9;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  JUROS E FINANCIAMENTO`,
      'O saldo de abertura de um mês é o saldo devedor de fechamento do mês anterior.');
    const HEADER = 4;
    cabecalhoTabela(ws, HEADER, 2, [
      { titulo: 'Mês', align: 'right' }, { titulo: 'Saldo de abertura', align: 'right' },
      { titulo: 'Saque', align: 'right' }, { titulo: 'Juros do mês', align: 'right' },
      { titulo: 'Fee', align: 'right' }, { titulo: 'Amortização', align: 'right' },
      { titulo: 'Saldo devedor', align: 'right' }, { titulo: 'Capacidade de saque restante', align: 'right' },
    ]);

    const primeira = HEADER + 1;
    const ultima = primeira + meses.length - 1;
    meses.forEach((m, i) => {
      const l = primeira + i;
      const abertura = i === 0 ? 0 : meses[i - 1].saldoDevedor;
      const valores = [m.mes, abertura, m.draw, m.juros, m.fee, m.amortization, m.saldoDevedor, m.capacidadeSaque];
      valores.forEach((v, k) => {
        const cel = ws.getCell(l, 2 + k);
        cel.value = v;
        cel.numFmt = k === 0 ? FMT_INT : MOEDA;
        cel.font = fonte();
        cel.alignment = dir;
      });
    });

    const totalLinha = ultima + 1;
    ws.getCell(totalLinha, 2).value = 'Total';
    ws.getCell(totalLinha, 2).alignment = esq;
    for (const c of [4, 5, 6, 7]) {
      const L = letra(ws, c);
      const cel = ws.getCell(totalLinha, c);
      cel.value = { formula: `SUM(${L}${primeira}:${L}${ultima})`, date1904: false };
      cel.numFmt = MOEDA;
      cel.alignment = dir;
    }
    estiloTotal(ws, totalLinha, 2, ULT);

    const r0 = totalLinha + 2;
    barraSecao(ws, r0, 2, ULT, 'Custo da dívida');
    par(ws, r0 + 1, 2, 'Dívida sacada', ap.dividaSacada, { numFmt: MOEDA });
    par(ws, r0 + 2, 2, 'Juros totais', ap.jurosTotais, { numFmt: MOEDA });
    par(ws, r0 + 3, 2, 'Fee de estruturação', ap.feeTotal, { numFmt: MOEDA });
    par(ws, r0 + 4, 2, 'Custo financeiro', ap.custoFinanceiro, { numFmt: MOEDA });
    par(ws, r0 + 1, 5, 'Dívida amortizada', ap.dividaAmortizada, { numFmt: MOEDA });
    par(ws, r0 + 2, 5, 'Teto de dívida', ap.tetoDivida, { numFmt: MOEDA });
    par(ws, r0 + 3, 5, 'LTC', ind.ltc ?? '–', { numFmt: ind.ltc == null ? undefined : FMT_PCT });
    par(ws, r0 + 4, 5, 'Custo total da dívida', ind.custoTotalDividaPct ?? '–', { numFmt: ind.custoTotalDividaPct == null ? undefined : FMT_PCT });

    nota(ws, r0 + 6, 2, ULT, input.financiamento.capitalizarJuros
      ? 'Capitalização de juros LIGADA: os juros do mês somam ao saldo devedor em vez de sair do caixa. Por isso a coluna "Juros do mês" não aparece no fluxo de caixa como pagamento.'
      : 'Capitalização de juros desligada: os juros de cada mês são pagos no próprio mês e aparecem na linha "Juros e taxas" do fluxo de caixa.');

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: HEADER, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ── 8 · Quadro de Investidores ────────────────────────────────────────────
  function abaInvestidores() {
    const larguras = [28, 14, 16, 16, 16, 10, 16, ...meses.map(() => 11.5)];
    const ws = novaAba(wb, 'Quadro de Investidores', larguras);
    const ULT = 1 + larguras.length;
    const COL_MES = 9;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  QUADRO DE INVESTIDORES`,
      'Rateio pro-rata e a chamada de capital de cada sócio, mês a mês.');
    const HEADER = 4;
    cabecalhoTabela(ws, HEADER, 2, [
      { titulo: 'Sócio' }, { titulo: 'Participação', align: 'right' }, { titulo: 'Capital', align: 'right' },
      { titulo: 'Lucro', align: 'right' }, { titulo: 'Total', align: 'right' }, { titulo: 'MOIC', align: 'right' },
      { titulo: 'Cota disponível', align: 'center' },
      ...meses.map((m) => ({ titulo: `M${m.mes}`, align: 'right' as const })),
    ]);
    // Segunda linha de cabeçalho só para as colunas de mês.
    meses.forEach((m, i) => {
      const cel = ws.getCell(HEADER + 1, COL_MES + i);
      const data = dataDoMes(m.data);
      cel.value = data ?? m.data;
      if (data) cel.numFmt = FMT_MES;
      cel.fill = fundo(T.azul);
      cel.font = fonte({ size: 8, color: { argb: T.branco } });
      cel.alignment = dir;
    });
    for (let c = 2; c < COL_MES; c++) {
      ws.getCell(HEADER + 1, c).fill = fundo(T.azul);
    }

    const primeira = HEADER + 2;
    resultado.rateioSocios.forEach((s, i) => {
      const l = primeira + i;
      ws.getCell(l, 2).value = s.nome || `Sócio ${i + 1}`;
      ws.getCell(l, 2).alignment = esq;
      ws.getCell(l, 3).value = s.participacaoPct;
      ws.getCell(l, 3).numFmt = FMT_PCT2;
      ws.getCell(l, 4).value = s.capital;
      ws.getCell(l, 5).value = s.lucro;
      ws.getCell(l, 6).value = s.total;
      for (const c of [4, 5, 6]) ws.getCell(l, c).numFmt = MOEDA;
      const moic = ws.getCell(l, 7);
      moic.value = ind.moic ?? '–';
      if (ind.moic != null) moic.numFmt = FMT_MULT;
      const cota = ws.getCell(l, 8);
      cota.value = s.cotaDisponivel ? 'SIM' : '–';
      cota.alignment = centro;
      cota.font = fonte({ bold: s.cotaDisponivel, color: { argb: s.cotaDisponivel ? T.dourado : T.cinza } });
      if (s.cotaDisponivel) cota.fill = fundo(T.cardCreme);
      s.chamadasPorMes.forEach((v, k) => {
        const cel = ws.getCell(l, COL_MES + k);
        cel.value = v;
        cel.numFmt = MOEDA;
        cel.alignment = dir;
        cel.font = fonte();
      });
      for (let c = 2; c <= 7; c++) {
        ws.getCell(l, c).font = ws.getCell(l, c).font ?? fonte();
        if (c > 2) ws.getCell(l, c).alignment = dir;
      }
      ws.getCell(l, 6).font = fonte({ bold: true });
    });

    const ultima = primeira + resultado.rateioSocios.length - 1;
    const totalLinha = ultima + 1;
    if (resultado.rateioSocios.length > 0) {
      ws.getCell(totalLinha, 2).value = 'Total';
      ws.getCell(totalLinha, 2).alignment = esq;
      for (let c = 3; c <= 6; c++) {
        const L = letra(ws, c);
        const cel = ws.getCell(totalLinha, c);
        cel.value = { formula: `SUM(${L}${primeira}:${L}${ultima})`, date1904: false };
        cel.numFmt = c === 3 ? FMT_PCT2 : MOEDA;
        cel.alignment = dir;
      }
      for (let k = 0; k < meses.length; k++) {
        const L = letra(ws, COL_MES + k);
        const cel = ws.getCell(totalLinha, COL_MES + k);
        cel.value = { formula: `SUM(${L}${primeira}:${L}${ultima})`, date1904: false };
        cel.numFmt = MOEDA;
        cel.alignment = dir;
      }
      estiloTotal(ws, totalLinha, 2, ULT);
    }

    nota(ws, totalLinha + 2, 2, ULT,
      'MOIC, ROI e TIR são idênticos para todos os sócios — o rateio é pro-rata, o que varia é só a escala. A coluna "Cota disponível" marca o capital ainda por captar.');

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: HEADER + 1, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ── 9 · Retorno do Investidor ─────────────────────────────────────────────
  function abaRetorno() {
    const ws = novaAba(wb, 'Retorno do Investidor', [38, 18, 2, 8, 14, 16, 16, 16]);
    const ULT = 9;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  RETORNO DO INVESTIDOR`,
      'À esquerda a apuração do projeto; à direita o fluxo do investidor, base da TIR.');

    const HEADER = 4;
    barraSecao(ws, HEADER, 2, 3, 'Apuração do resultado');
    const dre: { rotulo: string; valor: number; negativo?: boolean; total?: boolean }[] = [
      { rotulo: 'Receita bruta (VGV)', valor: ap.receitaBruta },
      { rotulo: '(−) Comissões', valor: -ap.comissoes, negativo: true },
      { rotulo: '(−) Cartório / closing', valor: -ap.cartorio, negativo: true },
      { rotulo: '(=) Receita líquida', valor: ap.receitaLiquida, total: true },
      { rotulo: '(−) Terrenos', valor: -ap.custoTerrenos, negativo: true },
      { rotulo: '(−) Obra', valor: -ap.custoObra, negativo: true },
      { rotulo: '(−) Property taxes', valor: -ap.custoPropertyTax, negativo: true },
      { rotulo: '(−) Outros custos', valor: -ap.custoOutros, negativo: true },
      { rotulo: '(=) Custo do empreendimento', valor: -ap.custoEmpreendimento, total: true },
      { rotulo: '(−) Juros', valor: -ap.jurosTotais, negativo: true },
      { rotulo: '(−) Fee de estruturação', valor: -ap.feeTotal, negativo: true },
      { rotulo: '(=) Custo financeiro', valor: -ap.custoFinanceiro, total: true },
      { rotulo: '(=) LUCRO DO PROJETO', valor: ap.lucroProjeto, total: true },
      { rotulo: 'Lucro dos investidores', valor: ap.lucroInvestidores },
      { rotulo: 'Lucro do sponsor', valor: ap.lucroSponsor },
    ];
    dre.forEach((item, i) => {
      const l = HEADER + 1 + i;
      const r = ws.getCell(l, 2);
      r.value = item.rotulo;
      r.alignment = esq;
      r.font = fonte({ bold: !!item.total, color: { argb: item.total ? T.navy : T.texto } });
      const v = ws.getCell(l, 3);
      v.value = item.valor;
      v.numFmt = MOEDA;
      v.alignment = dir;
      v.font = fonte({ bold: !!item.total, color: { argb: item.total ? T.navy : T.texto } });
      if (item.total) { r.fill = fundo(T.faixa); v.fill = fundo(T.faixa); }
    });

    barraSecao(ws, HEADER, 5, ULT, 'Fluxo do investidor');
    cabecalhoTabela(ws, HEADER + 1, 5, [
      { titulo: 'Mês', align: 'right' }, { titulo: 'Data', align: 'center' },
      { titulo: 'Aporte', align: 'right' }, { titulo: 'Distribuição', align: 'right' },
      { titulo: 'Líquido', align: 'right' },
    ]);
    const fi0 = HEADER + 2;
    meses.forEach((m, i) => {
      const l = fi0 + i;
      const data = dataDoMes(m.data);
      ws.getCell(l, 5).value = m.mes;
      ws.getCell(l, 5).numFmt = FMT_INT;
      ws.getCell(l, 6).value = data ?? m.data;
      if (data) ws.getCell(l, 6).numFmt = FMT_MES;
      ws.getCell(l, 6).alignment = centro;
      ws.getCell(l, 7).value = m.equityCall;
      ws.getCell(l, 8).value = m.distribution;
      ws.getCell(l, 9).value = resultado.fluxoInvestidor[i] ?? 0;
      for (const c of [7, 8, 9]) ws.getCell(l, c).numFmt = MOEDA;
      for (let c = 5; c <= 9; c++) {
        ws.getCell(l, c).font = fonte();
        if (c !== 6) ws.getCell(l, c).alignment = dir;
      }
    });
    const fiUlt = fi0 + meses.length - 1;
    const fiTotal = fiUlt + 1;
    ws.getCell(fiTotal, 5).value = 'Total';
    ws.getCell(fiTotal, 5).alignment = esq;
    for (const c of [7, 8, 9]) {
      const L = letra(ws, c);
      const cel = ws.getCell(fiTotal, c);
      cel.value = { formula: `SUM(${L}${fi0}:${L}${fiUlt})`, date1904: false };
      cel.numFmt = MOEDA;
      cel.alignment = dir;
    }
    estiloTotal(ws, fiTotal, 5, ULT);

    const r0 = Math.max(HEADER + dre.length + 1, fiTotal) + 2;
    barraSecao(ws, r0, 2, ULT, 'Indicadores de retorno');
    const itens: [string, number | null, string][] = [
      ['MOIC', ind.moic, FMT_MULT],
      ['ROI', ind.roi, FMT_PCT],
      ['TIR mensal', ind.tirMensal, FMT_PCT2],
      ['TIR anual', ind.tirAnual, FMT_PCT],
      ['XIRR', ind.xirr, FMT_PCT],
    ];
    itens.forEach(([rotulo, valor, fmt], i) => {
      par(ws, r0 + 1 + i, 2, rotulo, valor ?? '–', { numFmt: valor == null ? undefined : fmt });
    });
    nota(ws, r0 + 7, 2, ULT,
      'A TIR e o XIRR foram calculados pelo sistema (bisseção sobre o fluxo do investidor; XIRR em base actual/365), não pela função IRR do Excel. Diferenças no último decimal entre os dois são esperadas e não indicam erro.');

    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: HEADER + 1, showGridLines: false }];
  }

  // ── 10 · Sensibilidade ────────────────────────────────────────────────────
  function abaSensibilidade() {
    const grade = gradeSensibilidade(input);
    const equilibrio = pontosDeEquilibrio(input);
    const atrasos = sensibilidadePrazo(input);

    const ws = novaAba(wb, 'Sensibilidade', [22, 16, 16, 16, 16, 16, 16, 16]);
    const ULT = 9;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  SENSIBILIDADE`,
      'Cada célula é uma rodada completa do motor, não uma interpolação.');

    const COL0 = 3;
    const matriz = (linhaBarra: number, titulo: string, valor: (c: (typeof grade)[0][0]) => number | null, fmt: string, colorir: boolean) => {
      barraSecao(ws, linhaBarra, 2, COL0 + VARIACOES_CUSTO.length - 1, titulo);
      const header = linhaBarra + 1;
      cabecalhoTabela(ws, header, 2, [
        { titulo: 'Preço \\ Obra' },
        ...VARIACOES_CUSTO.map((vc) => ({ titulo: `${vc > 0 ? '+' : ''}${(vc * 100).toFixed(0)}%`, align: 'right' as const })),
      ]);
      grade.forEach((linha, i) => {
        const l = header + 1 + i;
        const r = ws.getCell(l, 2);
        r.value = `${VARIACOES_PRECO[i] > 0 ? '+' : ''}${(VARIACOES_PRECO[i] * 100).toFixed(0)}%`;
        r.font = fonte({ bold: true, color: { argb: T.navy } });
        r.fill = fundo(T.faixa);
        r.alignment = centro;
        linha.forEach((celula, k) => {
          const cel = ws.getCell(l, COL0 + k);
          cel.value = valor(celula) ?? '–';
          if (valor(celula) != null) cel.numFmt = fmt;
          cel.font = fonte();
          cel.alignment = dir;
          if (celula.variacaoPreco === 0 && celula.variacaoCusto === 0) {
            cel.font = fonte({ bold: true });
            cel.border = {
              top: { style: 'medium', color: { argb: T.navy } },
              bottom: { style: 'medium', color: { argb: T.navy } },
              left: { style: 'medium', color: { argb: T.navy } },
              right: { style: 'medium', color: { argb: T.navy } },
            };
          }
        });
      });
      const ultimaLinha = header + grade.length;
      if (colorir) {
        // Gradiente de três cores no corpo da matriz — o mesmo da tela.
        ws.addConditionalFormatting({
          ref: `${letra(ws, COL0)}${header + 1}:${letra(ws, COL0 + VARIACOES_CUSTO.length - 1)}${ultimaLinha}`,
          rules: [{
            type: 'colorScale',
            priority: 1,
            cfvo: [{ type: 'min' }, { type: 'num', value: 0 }, { type: 'max' }],
            color: [{ argb: 'FFF4A6A6' }, { argb: 'FFF1F5F9' }, { argb: 'FF7FC79B' }],
          }],
        });
      }
      return ultimaLinha;
    };

    let l = 4;
    l = matriz(l, 'Lucro do projeto', (c) => c.lucroProjeto, MOEDA, true) + 2;
    l = matriz(l, 'MOIC', (c) => c.moic, FMT_MULT, false) + 2;

    barraSecao(ws, l, 2, ULT, 'Cenários de prazo');
    cabecalhoTabela(ws, l + 1, 2, [
      { titulo: 'Atraso na venda' }, { titulo: 'Prazo total', align: 'right' },
      { titulo: 'Lucro do projeto', align: 'right' }, { titulo: 'MOIC', align: 'right' },
      { titulo: 'TIR anual', align: 'right' },
    ]);
    atrasos.forEach((a, i) => {
      const linha = l + 2 + i;
      ws.getCell(linha, 2).value = a.mesesAtraso === 0 ? 'Sem atraso (base)' : `+${a.mesesAtraso} meses`;
      ws.getCell(linha, 2).alignment = esq;
      ws.getCell(linha, 3).value = a.prazoTotal;
      ws.getCell(linha, 3).numFmt = FMT_INT;
      ws.getCell(linha, 4).value = a.lucroProjeto;
      ws.getCell(linha, 4).numFmt = MOEDA;
      ws.getCell(linha, 5).value = a.moic ?? '–';
      if (a.moic != null) ws.getCell(linha, 5).numFmt = FMT_MULT;
      ws.getCell(linha, 6).value = a.tirAnual ?? '–';
      if (a.tirAnual != null) ws.getCell(linha, 6).numFmt = FMT_PCT;
      for (let c = 2; c <= 6; c++) {
        ws.getCell(linha, c).font = fonte({ bold: a.mesesAtraso === 0 });
        if (c > 2) ws.getCell(linha, c).alignment = dir;
        if (a.mesesAtraso === 0) ws.getCell(linha, c).fill = fundo(T.faixa);
      }
    });
    l += atrasos.length + 3;

    barraSecao(ws, l, 2, ULT, 'Pontos de equilíbrio');
    cabecalhoTabela(ws, l + 1, 2, [
      { titulo: 'Ponto de equilíbrio' }, { titulo: 'Valor', align: 'right' }, { titulo: 'Referência atual', align: 'right' },
    ]);
    const equilibrios: [string, number | null, string, number | string][] = [
      ['VGV mínimo', equilibrio.vgvMinimo, MOEDA, ag.vgv],
      ['Queda máxima no preço', equilibrio.quedaMaximaPreco, FMT_PCT, 'antes do prejuízo'],
      ['Custo de obra máximo', equilibrio.custoObraMaximo, MOEDA, ag.obraTotal],
      ['Alta máxima na obra', equilibrio.altaMaximaCusto, FMT_PCT, 'antes do prejuízo'],
    ];
    equilibrios.forEach(([rotulo, valor, fmt, referencia], i) => {
      const linha = l + 2 + i;
      ws.getCell(linha, 2).value = rotulo;
      ws.getCell(linha, 2).alignment = esq;
      ws.getCell(linha, 2).font = fonte();
      const v = ws.getCell(linha, 3);
      v.value = valor ?? '–';
      if (valor != null) v.numFmt = fmt;
      v.font = fonte({ bold: true, color: { argb: T.navy } });
      v.alignment = dir;
      const ref = ws.getCell(linha, 4);
      ref.value = referencia;
      if (typeof referencia === 'number') ref.numFmt = MOEDA;
      ref.font = fonte({ color: { argb: T.cinza } });
      ref.alignment = dir;
    });

    ws.views = [{ showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ── 11 · Conferências ─────────────────────────────────────────────────────
  function abaConferencias() {
    const ws = novaAba(wb, 'Conferências', [34, 14, 26, 52, 52]);
    const ULT = 6;
    tituloAba(ws, 1, 2, ULT, `${nome.toUpperCase()}  ·  CONFERÊNCIAS`,
      'Onde o semáforo não é verde, a coluna "Como resolver" diz o que fazer.');
    const HEADER = 4;
    cabecalhoTabela(ws, HEADER, 2, [
      { titulo: 'Conferência' }, { titulo: 'Semáforo', align: 'center' }, { titulo: 'Valor', align: 'right' },
      { titulo: 'Detalhe' }, { titulo: 'Como resolver' },
    ]);
    resultado.conferencias.forEach((c, i) => {
      const l = HEADER + 1 + i;
      const cor = c.semaforo === 'verde' ? T.verdeClaro : c.semaforo === 'ambar' ? T.cardCreme : T.rosaClaro;
      const valores = [c.titulo, ROTULO_SEMAFORO[c.semaforo], c.valor, c.detalhe, c.semaforo === 'verde' ? '' : c.comoResolver];
      valores.forEach((v, k) => {
        const cel = ws.getCell(l, 2 + k);
        cel.value = v;
        cel.fill = fundo(cor);
        cel.font = fonte({ bold: k === 0, color: { argb: k === 0 ? T.navy : T.texto } });
        cel.alignment = k === 1 ? centro : k === 2 ? dir : { ...esq, wrapText: true };
      });
      ws.getRow(l).height = 26;
    });
    ws.autoFilter = {
      from: { row: HEADER, column: 2 },
      to: { row: HEADER + resultado.conferencias.length, column: ULT },
    };
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: HEADER, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
}

/** Baixa o arquivo. `XLSX.writeFile` não existe no exceljs: é buffer + Blob. */
export async function exportarXlsx(input: ModelInput, resultado: ModelOutput): Promise<void> {
  const wb = await construirWorkbookModelagem(input, resultado);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivoModelagem(input, 'xlsx');
  a.click();
  URL.revokeObjectURL(url);
}
