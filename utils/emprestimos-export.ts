/**
 * emprestimos-export.ts
 *
 * Exportação de PDF/Excel para o relatório de Empréstimos.
 * Segue o mesmo padrão visual, estrutural e de acabamento do
 * relatório de Retiradas (retiradas-export.ts).
 *
 * Regra de negócio:
 *   EMPRESTIMO -> saída de dinheiro da conta (exibido em vermelho, com prefixo -)
 *   PAGAMENTO  -> entrada de dinheiro na conta (exibido em verde, com prefixo +)
 */

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type RgbColor = [number, number, number];

export type EmprestimoTipo = 'EMPRESTIMO' | 'PAGAMENTO';

export type EmprestimosRow = {
  id: number;
  tipo: EmprestimoTipo | string;
  data_emprestimo: string | null;
  socio_nome:      string | null;
  matriz_nome:     string | null;
  conta_nome:      string | null;
  valor:           number | string | null;
  observacoes:     string | null;
};

export type EmprestimosExportFilters = {
  /** Ex: "01/01/2025 a 31/12/2025" ou "Todos os períodos" */
  periodoLabel: string;
  /** Descrição textual dos filtros ativos, ex: "Sócio: João | Matriz: SP" */
  filtrosDesc?: string;
};

type ExportContext = {
  formatCurrency: (value: number) => string;
};

// ─── Paleta de cores — idêntica ao relatório de retiradas ─────────────────────

const COLORS = {
  navy:      [17,  31,  59]  as RgbColor,
  navySoft:  [229, 236, 246] as RgbColor,
  graphite:  [59,  68,  82]  as RgbColor,
  slate:     [107, 114, 128] as RgbColor,
  border:    [217, 223, 232] as RgbColor,
  light:     [245, 247, 250] as RgbColor,
  white:     [255, 255, 255] as RgbColor,
  green:     [22,  101, 52]  as RgbColor,   // emerald — pagamentos (entrada)
  greenSoft: [236, 253, 245] as RgbColor,
  gold:      [146, 103, 33]  as RgbColor,
  goldSoft:  [255, 251, 235] as RgbColor,
  blue:      [29,  78,  216] as RgbColor,
  blueSoft:  [239, 246, 255] as RgbColor,
  rose:      [159, 18,  57]  as RgbColor,   // red-800 — empréstimos (saída)
  roseSoft:  [255, 228, 230] as RgbColor,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setFill(doc: jsPDF, c: RgbColor) { doc.setFillColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: RgbColor) { doc.setDrawColor(c[0], c[1], c[2]); }
function setText(doc: jsPDF, c: RgbColor) { doc.setTextColor(c[0], c[1], c[2]); }

/** Logo PROVISION — idêntico aos demais relatórios */
function drawProvisionLogo(doc: jsPDF, x: number, y: number, size: number, color: RgbColor) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const innerRadius  = size * 0.08;
  const outerDist    = size * 0.31;
  const outerRadius  = size * 0.065;

  setDraw(doc, color);
  setFill(doc, color);
  doc.setLineWidth(0.8);

  const pts = [
    { dx: 0,                 dy: -outerDist           },
    { dx:  outerDist * 0.72, dy: -outerDist * 0.72    },
    { dx:  outerDist,        dy: 0                    },
    { dx:  outerDist * 0.72, dy:  outerDist * 0.72    },
    { dx: 0,                 dy:  outerDist           },
    { dx: -outerDist * 0.72, dy:  outerDist * 0.72    },
    { dx: -outerDist,        dy: 0                    },
    { dx: -outerDist * 0.72, dy: -outerDist * 0.72    },
  ];
  pts.forEach(p => {
    doc.line(cx, cy, cx + p.dx, cy + p.dy);
    doc.circle(cx + p.dx, cy + p.dy, outerRadius, 'FD');
  });
  doc.circle(cx, cy, innerRadius, 'FD');
}

function formatDateTimeForDisplay(date: Date): string {
  const d = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const t = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  return `${d} às ${t}`;
}

function sanitizeFilename(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Converte "YYYY-MM-DD" ou ISO string → "dd/mm/yyyy" */
function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '-';
  const s = raw.split('T')[0];
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '-';
}

/** Converte valor de DB (número ou string numérica ou null) → number */
function toVal(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return parseFloat(String(v)) || 0;
}

function isEmprestimo(row: EmprestimosRow): boolean {
  return row.tipo === 'EMPRESTIMO';
}

export function tipoLabel(tipo: string): string {
  return tipo === 'PAGAMENTO' ? 'Pagamento' : 'Empréstimo';
}

// ─── Leitura Executiva ─────────────────────────────────────────────────────────

function buildExecutiveSummary(
  registros: EmprestimosRow[],
  filters:   EmprestimosExportFilters,
  formatCurrency: (v: number) => string,
): string[] {
  const totalEmprestimos = registros.filter(isEmprestimo).reduce((s, r) => s + toVal(r.valor), 0);
  const totalPagamentos  = registros.filter(r => !isEmprestimo(r)).reduce((s, r) => s + toVal(r.valor), 0);
  const saldo            = totalEmprestimos - totalPagamentos;

  const qtd    = registros.length;
  const qtdEmp = registros.filter(isEmprestimo).length;
  const qtdPag = qtd - qtdEmp;

  const socios   = [...new Set(registros.map(r => r.socio_nome  || 'Sem Sócio'))];
  const matrizes = [...new Set(registros.map(r => r.matriz_nome || 'Sem Matriz'))];

  const periodoText = filters.periodoLabel === 'Todos os períodos'
    ? 'sem filtro de período aplicado'
    : `no período de ${filters.periodoLabel}`;

  return [
    `O relatório contempla ${qtd} registro${qtd !== 1 ? 's' : ''} ${periodoText} — ${qtdEmp} empréstimo${qtdEmp !== 1 ? 's' : ''} e ${qtdPag} pagamento${qtdPag !== 1 ? 's' : ''} — envolvendo ${socios.length} sócio${socios.length !== 1 ? 's' : ''} e ${matrizes.length} matriz${matrizes.length !== 1 ? 'es' : ''}.`,
    `Os empréstimos concedidos (saídas de caixa) somam ${formatCurrency(totalEmprestimos)} e os pagamentos recebidos (entradas de caixa) somam ${formatCurrency(totalPagamentos)}.`,
    saldo > 0
      ? `O saldo devedor do período é de ${formatCurrency(saldo)}, valor ainda não devolvido ao caixa.`
      : saldo < 0
        ? `O saldo do período é credor em ${formatCurrency(Math.abs(saldo))}, indicando pagamentos superiores aos empréstimos concedidos no recorte filtrado.`
        : 'O saldo do período está zerado: os pagamentos recebidos equivalem exatamente aos empréstimos concedidos.',
    'Os valores refletem os filtros ativos no momento de emissão do relatório e impactam diretamente o extrato e o saldo das contas correntes envolvidas.',
  ];
}

// ─── Exportação Excel ──────────────────────────────────────────────────────────

export function exportEmprestimosExcel(
  registros: EmprestimosRow[],
  filters:   EmprestimosExportFilters,
  { formatCurrency }: ExportContext,
): void {
  const totalEmprestimos = registros.filter(isEmprestimo).reduce((s, r) => s + toVal(r.valor), 0);
  const totalPagamentos  = registros.filter(r => !isEmprestimo(r)).reduce((s, r) => s + toVal(r.valor), 0);
  const saldo            = totalEmprestimos - totalPagamentos;

  const summaryRows = [
    { Campo: 'Período',                 Valor: filters.periodoLabel },
    { Campo: 'Filtros aplicados',       Valor: filters.filtrosDesc || 'Sem filtros' },
    { Campo: 'Total de empréstimos',    Valor: formatCurrency(totalEmprestimos) },
    { Campo: 'Total de pagamentos',     Valor: formatCurrency(totalPagamentos) },
    { Campo: 'Saldo devedor',           Valor: formatCurrency(saldo) },
    { Campo: 'Quantidade de registros', Valor: registros.length },
  ];

  const detailRows = registros.map(r => {
    const valor = toVal(r.valor);
    // Sinal contábil: empréstimo sai do caixa (negativo), pagamento entra (positivo)
    const valorComSinal = isEmprestimo(r) ? -valor : valor;
    return {
      Data:          fmtDate(r.data_emprestimo),
      'Tipo':        tipoLabel(String(r.tipo)),
      'Sócio':       r.socio_nome  || '-',
      'Matriz':      r.matriz_nome || '-',
      'Conta':       r.conta_nome  || '-',
      'Valor':       valorComSinal,
      'Valor (fmt)': `${isEmprestimo(r) ? '-' : '+'} ${formatCurrency(valor)}`,
      'Observações': r.observacoes || '-',
    };
  });

  const totalsRow = {
    Data:          '',
    'Tipo':        'TOTAIS',
    'Sócio':       '',
    'Matriz':      '',
    'Conta':       `Empréstimos: ${formatCurrency(totalEmprestimos)} | Pagamentos: ${formatCurrency(totalPagamentos)}`,
    'Valor':       totalPagamentos - totalEmprestimos,
    'Valor (fmt)': `Saldo devedor: ${formatCurrency(saldo)}`,
    'Observações': '',
  };

  const wb = XLSX.utils.book_new();

  const wsResumo = XLSX.utils.json_to_sheet(summaryRows);
  wsResumo['!cols'] = [{ wch: 28 }, { wch: 40 }];

  const wsDetalhe = XLSX.utils.json_to_sheet([...detailRows, totalsRow]);
  wsDetalhe['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 25 }, { wch: 25 },
    { wch: 14 }, { wch: 22 }, { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, wsResumo,  'Resumo');
  XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Empréstimos');

  XLSX.writeFile(wb, `emprestimos_${sanitizeFilename(filters.periodoLabel)}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ─── Exportação PDF ────────────────────────────────────────────────────────────

export function exportEmprestimosPDF(
  registros: EmprestimosRow[],
  filters:   EmprestimosExportFilters,
  { formatCurrency }: ExportContext,
): void {
  // ── Pré-computar agregados ─────────────────────────────────────────────────
  const emprestimos = registros.filter(isEmprestimo);
  const pagamentos  = registros.filter(r => !isEmprestimo(r));

  const totalEmprestimos = emprestimos.reduce((s, r) => s + toVal(r.valor), 0);
  const totalPagamentos  = pagamentos.reduce((s, r) => s + toVal(r.valor), 0);
  const saldoDevedor     = totalEmprestimos - totalPagamentos;

  const qtd = registros.length;

  const socios   = [...new Set(registros.map(r => r.socio_nome  || 'Sem Sócio'))];
  const matrizes = [...new Set(registros.map(r => r.matriz_nome || 'Sem Matriz'))];
  const contas   = [...new Set(registros.map(r => r.conta_nome  || 'Sem Conta'))];

  const sociosDisplay   = socios.length   <= 3 ? socios.join(', ')   : `${socios.length} sócios`;
  const matrizesDisplay = matrizes.length <= 3 ? matrizes.join(', ') : `${matrizes.length} matrizes`;
  const contasDisplay   = contas.length   <= 3 ? contas.join(', ')   : `${contas.length} contas`;

  const summarySentences = buildExecutiveSummary(registros, filters, formatCurrency);

  // ── Configuração do documento ──────────────────────────────────────────────
  const doc          = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth    = doc.internal.pageSize.width;
  const pageHeight   = doc.internal.pageSize.height;
  const marginX      = 14;
  const contentWidth = pageWidth - marginX * 2;   // 182 mm
  const topStart     = 14;
  const bottomReserve = 18;
  const emittedAt     = new Date();
  const issuedAtLabel = formatDateTimeForDisplay(emittedAt);

  let y = topStart;

  const addPage = () => { doc.addPage(); y = topStart; };

  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - bottomReserve) addPage();
  };

  const drawSectionTitle = (eyebrow: string, title: string) => {
    ensureSpace(16);
    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(eyebrow.toUpperCase(), marginX, y);
    y += 4;

    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, marginX, y);
    y += 4.5;

    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.35);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  };

  // ── Cabeçalho executivo ────────────────────────────────────────────────────
  const drawHeader = () => {
    const hh = 34;
    setFill(doc, COLORS.navy);
    doc.roundedRect(marginX, y, contentWidth, hh, 4, 4, 'F');

    drawProvisionLogo(doc, marginX + 5, y + 5, 18, COLORS.white);

    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROVISION', marginX + 28, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Relatório Financeiro', pageWidth - marginX - 4, y + 8, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Relatório de Empréstimos', marginX + 28, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(filters.periodoLabel, marginX + 28, y + 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Emitido em ${issuedAtLabel}`, marginX + 28, y + 30);

    setFill(doc, COLORS.white);
    doc.roundedRect(pageWidth - marginX - 44, y + 21, 40, 8, 3, 3, 'F');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Empréstimos e Pagamentos', pageWidth - marginX - 24, y + 26.2, { align: 'center' });

    y += hh + 4;
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  // ── Bloco de identificação ─────────────────────────────────────────────────
  const drawInfoBlock = () => {
    drawSectionTitle('Identificação', 'Dados do Relatório');

    const infoItems = [
      { label: 'Período',                 value: filters.periodoLabel },
      { label: 'Total de Empréstimos',    value: formatCurrency(totalEmprestimos) },
      { label: 'Total de Pagamentos',     value: formatCurrency(totalPagamentos) },
      { label: 'Saldo Devedor',           value: formatCurrency(saldoDevedor) },
      { label: 'Quantidade de Registros', value: `${qtd} registro${qtd !== 1 ? 's' : ''}` },
      { label: 'Sócios Considerados',     value: sociosDisplay },
      { label: 'Matrizes Consideradas',   value: matrizesDisplay },
      { label: 'Contas Consideradas',     value: contasDisplay },
      { label: 'Filtros Aplicados',       value: filters.filtrosDesc || 'Sem filtros aplicados' },
    ];

    const gap      = 5;
    const colWidth = (contentWidth - gap) / 2;
    const rowHeights: number[] = [];

    for (let i = 0; i < infoItems.length; i += 2) {
      const pair = infoItems.slice(i, i + 2);
      const rh = pair.reduce((h, item) => {
        const lines = doc.splitTextToSize(item.value, colWidth - 8);
        return Math.max(h, 10 + lines.length * 4.2);
      }, 16);
      rowHeights.push(rh);
    }

    ensureSpace(rowHeights.reduce((s, h) => s + h + 4, 0));

    let localY = y;
    infoItems.forEach((item, i) => {
      const rowIdx = Math.floor(i / 2);
      const colIdx = i % 2;
      const x  = marginX + colIdx * (colWidth + gap);
      const bh = rowHeights[rowIdx];

      setFill(doc, COLORS.light);
      setDraw(doc, COLORS.border);
      doc.roundedRect(x, localY, colWidth, bh, 3, 3, 'FD');

      setText(doc, COLORS.slate);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(item.label.toUpperCase(), x + 4, localY + 5);

      setText(doc, COLORS.navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(item.value, colWidth - 8);
      doc.text(lines, x + 4, localY + 10.5);

      if (colIdx === 1) localY += bh + 4;
    });

    if (infoItems.length % 2 !== 0) localY += rowHeights[rowHeights.length - 1] + 4;
    y = localY + 2;
  };

  // ── Card de métrica ────────────────────────────────────────────────────────
  const drawMetricCard = (
    x: number, cardY: number, width: number, height: number,
    label: string, value: string,
    tone: 'default' | 'positive' | 'negative' | 'highlight' | 'accent' = 'default',
  ) => {
    const palette =
      tone === 'positive'  ? { bg: COLORS.greenSoft, text: COLORS.green,    border: COLORS.border } :
      tone === 'negative'  ? { bg: COLORS.roseSoft,  text: COLORS.rose,     border: COLORS.border } :
      tone === 'highlight' ? { bg: COLORS.navySoft,  text: COLORS.navy,     border: COLORS.navy   } :
      tone === 'accent'    ? { bg: COLORS.goldSoft,  text: COLORS.gold,     border: COLORS.border } :
                             { bg: COLORS.white,     text: COLORS.graphite, border: COLORS.border };

    setFill(doc, palette.bg);
    setDraw(doc, palette.border);
    doc.roundedRect(x, cardY, width, height, 3, 3, 'FD');

    if (tone === 'highlight') {
      setFill(doc, COLORS.navy);
      doc.roundedRect(x, cardY, width, 3, 3, 3, 'F');
    }

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 4, cardY + 7);

    setText(doc, palette.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const vLines = doc.splitTextToSize(value, width - 8);
    doc.text(vLines, x + 4, cardY + 14);
  };

  // ── Painel executivo ───────────────────────────────────────────────────────
  const drawIndicatorCards = () => {
    drawSectionTitle('Indicadores', 'Painel Executivo');

    const gap       = 4;
    const cols      = 2;
    const cardWidth = (contentWidth - gap) / cols;
    const cardH     = 20;

    const cards = [
      { label: 'Total de Empréstimos (saídas)', value: formatCurrency(totalEmprestimos), tone: 'negative'  as const },
      { label: 'Total de Pagamentos (entradas)', value: formatCurrency(totalPagamentos), tone: 'positive'  as const },
      { label: 'Saldo Devedor do Período',       value: formatCurrency(saldoDevedor),    tone: 'highlight' as const },
      { label: 'Quantidade de Registros',        value: `${qtd} registro${qtd !== 1 ? 's' : ''}`, tone: 'default' as const },
      { label: 'Empréstimos Concedidos',         value: `${emprestimos.length} lançamento${emprestimos.length !== 1 ? 's' : ''}`, tone: 'default' as const },
      { label: 'Pagamentos Recebidos',           value: `${pagamentos.length} lançamento${pagamentos.length !== 1 ? 's' : ''}`,  tone: 'default' as const },
      { label: 'Quantidade de Sócios',           value: `${socios.length} sócio${socios.length !== 1 ? 's' : ''}`, tone: 'default' as const },
      { label: 'Quantidade de Contas',           value: `${contas.length} conta${contas.length !== 1 ? 's' : ''}`, tone: 'default' as const },
    ];

    let localY = y;
    cards.forEach((card, i) => {
      if (i % cols === 0) ensureSpace(cardH + 4);
      const x = marginX + (i % cols) * (cardWidth + gap);
      drawMetricCard(x, localY, cardWidth, cardH, card.label, card.value, card.tone);
      if (i % cols === cols - 1) localY += cardH + gap;
    });
    if (cards.length % cols !== 0) localY += cardH + gap;
    y = localY + 2;
  };

  // ── Leitura executiva ──────────────────────────────────────────────────────
  const drawExecutiveSummary = () => {
    drawSectionTitle('Leitura Executiva', 'Resumo Executivo');

    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);

    const lineHeights = summarySentences.map(s =>
      doc.splitTextToSize(`• ${s}`, contentWidth - 10).length * 5.1,
    );
    const blockH = lineHeights.reduce((s, h) => s + h, 10);
    ensureSpace(blockH + 4);
    doc.roundedRect(marginX, y, contentWidth, blockH, 3, 3, 'FD');

    let ty = y + 7;
    summarySentences.forEach(s => {
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.2);
      const lines = doc.splitTextToSize(`• ${s}`, contentWidth - 10);
      doc.text(lines, marginX + 5, ty);
      ty += lines.length * 5.1;
    });

    y += blockH + 6;
  };

  // ── Tabela de empréstimos ──────────────────────────────────────────────────
  const drawEmprestimosTable = () => {
    drawSectionTitle('Detalhamento', 'Tabela de Empréstimos');

    // Colunas: total 182 mm
    const columns = [
      { label: 'Data',       width: 19, align: 'center' as const },
      { label: 'Tipo',       width: 22, align: 'left'   as const },
      { label: 'Sócio',      width: 29, align: 'left'   as const },
      { label: 'Matriz',     width: 27, align: 'left'   as const },
      { label: 'Conta',      width: 24, align: 'left'   as const },
      { label: 'Valor',      width: 25, align: 'right'  as const },
      { label: 'Observação', width: 36, align: 'left'   as const },
    ];
    const VALOR_COL = 5;

    const colX: number[] = [];
    let rx = marginX;
    columns.forEach(c => { colX.push(rx); rx += c.width; });

    const drawTableHeader = () => {
      ensureSpace(10);
      setFill(doc, COLORS.navy);
      doc.rect(marginX, y, contentWidth, 8, 'F');
      setText(doc, COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      columns.forEach((col, i) => {
        const hx =
          col.align === 'right'  ? colX[i] + col.width - 2 :
          col.align === 'center' ? colX[i] + col.width / 2 :
                                   colX[i] + 2;
        doc.text(col.label, hx, y + 5, {
          align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
        });
      });
      y += 8;
    };

    drawTableHeader();

    // Agrupar por sócio (preserva ordem de chegada)
    const grouped = new Map<string, EmprestimosRow[]>();
    registros.forEach(r => {
      const k = r.socio_nome || 'Sem Sócio';
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    });

    grouped.forEach((rows, socioNome) => {
      // ── Cabeçalho do grupo (sócio) ────────────────────────────────────────
      const groupH = 7;
      if (y + groupH > pageHeight - bottomReserve) { addPage(); drawTableHeader(); }

      setFill(doc, COLORS.navySoft);
      doc.rect(marginX, y, contentWidth, groupH, 'F');
      setText(doc, COLORS.navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`Sócio: ${socioNome}`, marginX + 3, y + 4.8);
      y += groupH;

      let socioEmprestimos = 0;
      let socioPagamentos  = 0;
      let rowIdx = 0;

      // ── Linhas do grupo ───────────────────────────────────────────────────
      rows.forEach(r => {
        const obsLines = doc.splitTextToSize(r.observacoes || '-', columns[6].width - 4);
        const rowH     = Math.max(9, obsLines.length * 4.4 + 4.5);

        if (y + rowH > pageHeight - bottomReserve) { addPage(); drawTableHeader(); }

        const saida = isEmprestimo(r);

        // Zebra striping
        setFill(doc, rowIdx % 2 === 0 ? COLORS.light : COLORS.white);
        doc.rect(marginX, y, contentWidth, rowH, 'F');
        setDraw(doc, COLORS.border);
        doc.setLineWidth(0.2);
        doc.line(marginX, y + rowH, pageWidth - marginX, y + rowH);

        const ty = y + 5.2;
        setText(doc, COLORS.graphite);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);

        doc.text(
          fmtDate(r.data_emprestimo),
          colX[0] + columns[0].width / 2, ty,
          { align: 'center' },
        );

        // Tipo — colorido conforme o sentido do dinheiro
        setText(doc, saida ? COLORS.rose : COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(tipoLabel(String(r.tipo)), colX[1] + 2, ty);

        setText(doc, COLORS.graphite);
        doc.setFont('helvetica', 'normal');

        const socioLines  = doc.splitTextToSize(r.socio_nome  || '-', columns[2].width - 4);
        const matrizLines = doc.splitTextToSize(r.matriz_nome || '-', columns[3].width - 4);
        const contaLines  = doc.splitTextToSize(r.conta_nome  || '-', columns[4].width - 4);

        doc.text(socioLines,  colX[2] + 2, ty);
        doc.text(matrizLines, colX[3] + 2, ty);
        doc.text(contaLines,  colX[4] + 2, ty);

        // Valor — vermelho para empréstimo (saída), verde para pagamento (entrada)
        const valor = toVal(r.valor);
        setText(doc, saida ? COLORS.rose : COLORS.green);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `${saida ? '-' : '+'} ${formatCurrency(valor)}`,
          colX[VALOR_COL] + columns[VALOR_COL].width - 2, ty,
          { align: 'right' },
        );

        setText(doc, COLORS.graphite);
        doc.setFont('helvetica', 'normal');
        doc.text(obsLines, colX[6] + 2, ty);

        if (saida) socioEmprestimos += valor;
        else       socioPagamentos  += valor;

        y += rowH;
        rowIdx++;
      });

      // ── Linha de subtotal do sócio ────────────────────────────────────────
      const subtotalH = 8;
      if (y + subtotalH > pageHeight - bottomReserve) { addPage(); drawTableHeader(); }

      setFill(doc, COLORS.navySoft);
      doc.rect(marginX, y, contentWidth, subtotalH, 'F');
      setText(doc, COLORS.navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`Subtotal — ${socioNome}`, marginX + 3, y + 5.5);

      setText(doc, COLORS.rose);
      doc.setFontSize(7.8);
      doc.text(`Empréstimos: ${formatCurrency(socioEmprestimos)}`, colX[2] + 2, y + 5.5);
      setText(doc, COLORS.green);
      doc.text(`Pagamentos: ${formatCurrency(socioPagamentos)}`, colX[4] - 6, y + 5.5);

      setText(doc, COLORS.navy);
      doc.setFontSize(8.5);
      doc.text(
        formatCurrency(socioEmprestimos - socioPagamentos),
        colX[VALOR_COL] + columns[VALOR_COL].width - 2, y + 5.5,
        { align: 'right' },
      );
      y += subtotalH + 2;
    });

    // ── Rodapé de totais ──────────────────────────────────────────────────────
    ensureSpace(30);

    setFill(doc, COLORS.roseSoft);
    setDraw(doc, COLORS.border);
    doc.rect(marginX, y, contentWidth, 8, 'FD');
    setText(doc, COLORS.rose);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Empréstimos  —  ${emprestimos.length} lançamento${emprestimos.length !== 1 ? 's' : ''}`, marginX + 3, y + 5.5);
    doc.text(formatCurrency(totalEmprestimos), pageWidth - marginX - 2, y + 5.5, { align: 'right' });
    y += 8;

    setFill(doc, COLORS.greenSoft);
    doc.rect(marginX, y, contentWidth, 8, 'FD');
    setText(doc, COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Pagamentos  —  ${pagamentos.length} lançamento${pagamentos.length !== 1 ? 's' : ''}`, marginX + 3, y + 5.5);
    doc.text(formatCurrency(totalPagamentos), pageWidth - marginX - 2, y + 5.5, { align: 'right' });
    y += 8;

    setFill(doc, COLORS.navy);
    doc.rect(marginX, y, contentWidth, 10, 'F');
    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Saldo Devedor  (empréstimos - pagamentos)', marginX + 3, y + 6.8);
    doc.text(formatCurrency(saldoDevedor), pageWidth - marginX - 2, y + 6.8, { align: 'right' });
    y += 16;
  };

  // ── Critérios / Observações ────────────────────────────────────────────────
  const drawCriteria = () => {
    drawSectionTitle('Critérios', 'Observações do Relatório');

    const items = [
      'Empréstimos representam SAÍDA de dinheiro da conta corrente e são exibidos em vermelho, com sinal negativo.',
      'Pagamentos de empréstimo representam ENTRADA de dinheiro na conta corrente e são exibidos em verde, com sinal positivo.',
      'O saldo devedor corresponde ao total de empréstimos menos o total de pagamentos dentro do conjunto filtrado.',
      'O relatório considera todos os registros retornados pelo filtro ativo, independentemente da página exibida na tela.',
    ];

    const gap      = 4;
    const colWidth = (contentWidth - gap) / 2;
    const heights  = items.map(item => {
      const lines = doc.splitTextToSize(item, colWidth - 10);
      return Math.max(16, 9 + lines.length * 4.4);
    });

    let localY = y;
    items.forEach((item, i) => {
      if (i % 2 === 0) ensureSpace(Math.max(heights[i], heights[i + 1] ?? 0) + 4);

      const x = marginX + (i % 2) * (colWidth + gap);
      const h = heights[i];

      setFill(doc, COLORS.light);
      setDraw(doc, COLORS.border);
      doc.roundedRect(x, localY, colWidth, h, 3, 3, 'FD');

      setFill(doc, COLORS.navy);
      doc.circle(x + 5, localY + 6, 1.4, 'F');

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      const lines = doc.splitTextToSize(item, colWidth - 10);
      doc.text(lines, x + 9, localY + 7);

      if (i % 2 === 1) localY += Math.max(heights[i], heights[i - 1]) + gap;
    });

    if (items.length % 2 !== 0) localY += heights[heights.length - 1] + gap;
    y = localY;
  };

  // ── Renderizar todas as seções ─────────────────────────────────────────────
  drawHeader();
  drawInfoBlock();
  drawIndicatorCards();
  drawExecutiveSummary();
  drawEmprestimosTable();
  drawCriteria();

  // ── Rodapé em todas as páginas ────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);

    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.35);
    doc.line(marginX, pageHeight - 12.5, pageWidth - marginX, pageHeight - 12.5);

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PROVISION', marginX, pageHeight - 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Sistema de Gestão Financeira e Projetos', marginX + 19, pageHeight - 8);
    doc.text(`Emitido em ${issuedAtLabel}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Página ${page} de ${pages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  const periodStr = sanitizeFilename(filters.periodoLabel);
  doc.save(`emprestimos_${periodStr}_${new Date().toISOString().split('T')[0]}.pdf`);
}
