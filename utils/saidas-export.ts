import jsPDF from 'jspdf';

export interface RelatorioSaidaItem {
  numero_documento?: string;
  fornecedor_nome: string;
  matriz_nome?: string;
  projeto_nomes?: string;
  valor: number;
  data_pagamento?: string;
  status: string;
  data_vencimento: string;
  data_competencia?: string;
  conta_nome?: string;
  conta_banco?: string;
  grupo_contabil?: string;
  subgrupo_contabil?: string;
  conta_id?: number;
  observacoes?: string;
}

export interface SaidasExportFilters {
  periodoInicioLabel?: string;
  periodoFimLabel?: string;
  statusLabel?: string;
  fornecedorLabel?: string;
  matrizLabel?: string;
  projetosLabel?: string;
  grupoContabilLabel?: string;
}

type ExportContext = {
  formatCurrency: (value: number) => string;
};

type RgbColor = [number, number, number];

const COLORS = {
  navy: [17, 31, 59] as RgbColor,
  navySoft: [229, 236, 246] as RgbColor,
  graphite: [59, 68, 82] as RgbColor,
  slate: [107, 114, 128] as RgbColor,
  border: [217, 223, 232] as RgbColor,
  light: [245, 247, 250] as RgbColor,
  white: [255, 255, 255] as RgbColor,
  green: [22, 101, 52] as RgbColor,
  greenSoft: [236, 253, 245] as RgbColor,
  gold: [146, 103, 33] as RgbColor,
  goldSoft: [255, 251, 235] as RgbColor,
  blue: [29, 78, 216] as RgbColor,
  blueSoft: [239, 246, 255] as RgbColor,
  rose: [190, 24, 93] as RgbColor,
  roseSoft: [255, 241, 242] as RgbColor,
} as const;

function setFill(doc: jsPDF, color: RgbColor) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: jsPDF, color: RgbColor) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: RgbColor) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function formatDateTimeNow(): string {
  const now = new Date();
  const datePart = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  const timePart = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return `${datePart} às ${timePart}`;
}

function safeDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const raw = String(dateStr).split('T')[0];
    const d = new Date(raw + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
  } catch {
    return dateStr;
  }
}

function safeValue(val: unknown): number {
  const n = parseFloat(String(val ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function sanitizeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function truncate(text: string, max: number): string {
  if (!text) return '-';
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

function drawProvisionLogo(doc: jsPDF, x: number, y: number, size: number, color: RgbColor) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const innerRadius = size * 0.08;
  const outerDistance = size * 0.31;
  const outerRadius = size * 0.065;

  setDraw(doc, color);
  setFill(doc, color);
  doc.setLineWidth(0.8);

  const points = [
    { dx: 0, dy: -outerDistance },
    { dx: outerDistance * 0.72, dy: -outerDistance * 0.72 },
    { dx: outerDistance, dy: 0 },
    { dx: outerDistance * 0.72, dy: outerDistance * 0.72 },
    { dx: 0, dy: outerDistance },
    { dx: -outerDistance * 0.72, dy: outerDistance * 0.72 },
    { dx: -outerDistance, dy: 0 },
    { dx: -outerDistance * 0.72, dy: -outerDistance * 0.72 },
  ];

  points.forEach((point) => {
    doc.line(centerX, centerY, centerX + point.dx, centerY + point.dy);
    doc.circle(centerX + point.dx, centerY + point.dy, outerRadius, 'FD');
  });

  doc.circle(centerX, centerY, innerRadius, 'FD');
}

// ─── Shared drawing primitives ────────────────────────────────────────────────

function makePdfEngine(doc: jsPDF, issuedAtLabel: string) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const topStart = 14;
  const bottomReserve = 18;
  let y = topStart;

  const addPage = () => {
    doc.addPage();
    y = topStart;
  };

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

  const drawHeader = (reportTitle: string, sealLabel: string) => {
    const headerHeight = 34;
    setFill(doc, COLORS.navy);
    doc.roundedRect(marginX, y, contentWidth, headerHeight, 4, 4, 'F');

    drawProvisionLogo(doc, marginX + 5, y + 5, 18, COLORS.white);

    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROVISION', marginX + 28, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Relatório Financeiro', pageWidth - marginX - 4, y + 8, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(reportTitle, marginX + 28, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Emitido em ${issuedAtLabel}`, marginX + 28, y + 27);

    setFill(doc, COLORS.white);
    doc.roundedRect(pageWidth - marginX - 42, y + 21, 38, 8, 3, 3, 'F');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(sealLabel, pageWidth - marginX - 23, y + 26.2, { align: 'center' });

    y += headerHeight + 4;
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  const drawInfoBlock = (labels: { label: string; value: string }[]) => {
    drawSectionTitle('Identificação', 'Dados do Relatório');

    const gap = 5;
    const colWidth = (contentWidth - gap) / 2;
    const rowHeights: number[] = [];

    for (let i = 0; i < labels.length; i += 2) {
      const pair = labels.slice(i, i + 2);
      const rowH = pair.reduce((h, item) => {
        const lines = doc.splitTextToSize(item.value, colWidth - 8);
        return Math.max(h, 10 + lines.length * 4.2);
      }, 16);
      rowHeights.push(rowH);
    }

    ensureSpace(rowHeights.reduce((s, h) => s + h + 4, 0));

    let localY = y;
    labels.forEach((item, index) => {
      const rowIndex = Math.floor(index / 2);
      const colIndex = index % 2;
      const x = marginX + colIndex * (colWidth + gap);
      const boxHeight = rowHeights[rowIndex];

      setFill(doc, COLORS.light);
      setDraw(doc, COLORS.border);
      doc.roundedRect(x, localY, colWidth, boxHeight, 3, 3, 'FD');

      setText(doc, COLORS.slate);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(item.label.toUpperCase(), x + 4, localY + 5);

      setText(doc, COLORS.navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const valueLines = doc.splitTextToSize(item.value, colWidth - 8);
      doc.text(valueLines, x + 4, localY + 10.5);

      if (colIndex === 1) localY += boxHeight + 4;
    });

    // If odd number of items, advance after last row
    if (labels.length % 2 !== 0) {
      localY += rowHeights[rowHeights.length - 1] + 4;
    }

    y = localY + 2;
  };

  const drawMetricCard = (
    x: number,
    cardY: number,
    width: number,
    height: number,
    label: string,
    value: string,
    tone: 'default' | 'positive' | 'highlight' | 'accent' | 'rose' = 'default',
  ) => {
    const palette =
      tone === 'positive'
        ? { bg: COLORS.greenSoft, text: COLORS.green, border: COLORS.border }
        : tone === 'highlight'
          ? { bg: COLORS.navySoft, text: COLORS.navy, border: COLORS.navy }
          : tone === 'accent'
            ? { bg: COLORS.goldSoft, text: COLORS.gold, border: COLORS.border }
            : tone === 'rose'
              ? { bg: COLORS.roseSoft, text: COLORS.rose, border: COLORS.border }
              : { bg: COLORS.white, text: COLORS.graphite, border: COLORS.border };

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
    const valueLines = doc.splitTextToSize(value, width - 8);
    doc.text(valueLines, x + 4, cardY + 14);
  };

  const drawIndicatorCards = (
    cards: { label: string; value: string; tone?: 'default' | 'positive' | 'highlight' | 'accent' | 'rose' }[],
  ) => {
    drawSectionTitle('Indicadores', 'Painel Executivo');

    const gap = 4;
    const cols = 2;
    const cardWidth = (contentWidth - gap) / cols;
    const cardHeight = 20;
    let localY = y;

    cards.forEach((card, index) => {
      if (index % cols === 0) ensureSpace(cardHeight + 4);
      const x = marginX + (index % cols) * (cardWidth + gap);
      drawMetricCard(x, localY, cardWidth, cardHeight, card.label, card.value, card.tone ?? 'default');
      if (index % cols === cols - 1) localY += cardHeight + gap;
    });

    if (cards.length % cols !== 0) localY += cardHeight + gap;
    y = localY + 2;
  };

  const drawExecutiveSummary = (sentences: string[]) => {
    drawSectionTitle('Leitura Executiva', 'Resumo Executivo');
    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);

    const lineHeights = sentences.map(
      (s) => doc.splitTextToSize(`• ${s}`, contentWidth - 10).length * 5.1,
    );
    const blockHeight = lineHeights.reduce((sum, h) => sum + h, 10);
    ensureSpace(blockHeight + 4);
    doc.roundedRect(marginX, y, contentWidth, blockHeight, 3, 3, 'FD');

    let textY = y + 7;
    sentences.forEach((sentence) => {
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.2);
      const lines = doc.splitTextToSize(`• ${sentence}`, contentWidth - 10);
      doc.text(lines, marginX + 5, textY);
      textY += lines.length * 5.1;
    });

    y += blockHeight + 6;
  };

  const drawTableHeader = (columns: { label: string; width: number; align: 'left' | 'right' | 'center' }[], colX: number[]) => {
    ensureSpace(10);
    setFill(doc, COLORS.navy);
    doc.rect(marginX, y, contentWidth, 8, 'F');
    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);

    columns.forEach((col, i) => {
      const hx =
        col.align === 'right'
          ? colX[i] + col.width - 2
          : col.align === 'center'
            ? colX[i] + col.width / 2
            : colX[i] + 2;
      doc.text(col.label, hx, y + 5, {
        align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
      });
    });

    y += 8;
  };

  const drawTableRow = (
    cells: string[],
    columns: { label: string; width: number; align: 'left' | 'right' | 'center' }[],
    colX: number[],
    rowIndex: number,
    isSubtotalRow = false,
  ) => {
    const rowHeight = 8;

    if (y + rowHeight > pageHeight - bottomReserve) {
      addPage();
      drawTableHeader(columns, colX);
    }

    if (!isSubtotalRow) {
      setFill(doc, rowIndex % 2 === 0 ? COLORS.light : COLORS.white);
      doc.rect(marginX, y, contentWidth, rowHeight, 'F');
    }

    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(marginX, y + rowHeight, pageWidth - marginX, y + rowHeight);

    const textY = y + 5.2;
    setText(doc, COLORS.graphite);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);

    cells.forEach((cell, i) => {
      const col = columns[i];
      const cx =
        col.align === 'right'
          ? colX[i] + col.width - 2
          : col.align === 'center'
            ? colX[i] + col.width / 2
            : colX[i] + 2;
      doc.text(truncate(cell, 28), cx, textY, {
        align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
      });
    });

    y += rowHeight;
  };

  const drawStatusBadge = (status: string, x: number, rowY: number) => {
    const isPago = status === 'PAGO';
    const bg = isPago ? COLORS.greenSoft : COLORS.goldSoft;
    const fg = isPago ? COLORS.green : COLORS.gold;
    const w = 18;

    setFill(doc, bg);
    doc.roundedRect(x, rowY + 1.5, w, 5, 2, 2, 'F');
    setText(doc, fg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(status, x + w / 2, rowY + 5, { align: 'center' });
  };

  const drawGroupHeader = (label: string, subtotalLabel: string, subtotalValue: string) => {
    // Group title bar
    ensureSpace(10);
    setFill(doc, COLORS.navySoft);
    setDraw(doc, COLORS.border);
    doc.roundedRect(marginX, y, contentWidth, 8, 2, 2, 'FD');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, marginX + 4, y + 5.5);
    y += 10;
    void subtotalLabel;
    void subtotalValue;
  };

  const drawGroupFooter = (subtotalLabel: string, subtotalValue: string, count: number, formatCurrency: (v: number) => string) => {
    ensureSpace(12);
    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);
    doc.roundedRect(marginX, y, contentWidth, 9, 2, 2, 'FD');

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${subtotalLabel} — ${count} lançamento(s)`, marginX + 4, y + 6);

    setText(doc, COLORS.rose);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(subtotalValue, pageWidth - marginX - 4, y + 6, { align: 'right' });

    y += 12;
    void formatCurrency;
  };

  const drawGrandTotal = (label: string, value: string, count: number) => {
    ensureSpace(20);
    setFill(doc, COLORS.navy);
    doc.roundedRect(marginX, y, contentWidth, 12, 3, 3, 'F');
    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label} — ${count} registro(s)`, marginX + 4, y + 8);
    doc.setFontSize(11);
    doc.text(value, pageWidth - marginX - 4, y + 8, { align: 'right' });
    y += 16;
  };

  const drawCriteria = (items: string[]) => {
    drawSectionTitle('Critérios', 'Observações do Relatório');

    const gap = 4;
    const colWidth = (contentWidth - gap) / 2;
    const heights = items.map((item) => {
      const lines = doc.splitTextToSize(item, colWidth - 10);
      return Math.max(16, 9 + lines.length * 4.4);
    });

    let localY = y;
    items.forEach((item, index) => {
      if (index % 2 === 0) ensureSpace(Math.max(heights[index], heights[index + 1] ?? 0) + 4);
      const x = marginX + (index % 2) * (colWidth + gap);
      const height = heights[index];

      setFill(doc, COLORS.light);
      setDraw(doc, COLORS.border);
      doc.roundedRect(x, localY, colWidth, height, 3, 3, 'FD');

      setFill(doc, COLORS.navy);
      doc.circle(x + 5, localY + 6, 1.4, 'F');

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      const lines = doc.splitTextToSize(item, colWidth - 10);
      doc.text(lines, x + 9, localY + 7);

      if (index % 2 === 1) localY += Math.max(heights[index], heights[index - 1]) + gap;
    });

    if (items.length % 2 !== 0) localY += heights[heights.length - 1] + gap;
    y = localY;
  };

  const drawFooters = () => {
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
      doc.text('Sistema de Gestão Financeira e Projetos', marginX + 20, pageHeight - 8);
      doc.text(`Emitido em ${issuedAtLabel}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      doc.text(`Página ${page} de ${pages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
    }
  };

  return {
    get y() { return y; },
    set y(v: number) { y = v; },
    pageWidth,
    pageHeight,
    marginX,
    contentWidth,
    bottomReserve,
    addPage,
    ensureSpace,
    drawSectionTitle,
    drawHeader,
    drawInfoBlock,
    drawMetricCard,
    drawIndicatorCards,
    drawExecutiveSummary,
    drawTableHeader,
    drawTableRow,
    drawStatusBadge,
    drawGroupHeader,
    drawGroupFooter,
    drawGrandTotal,
    drawCriteria,
    drawFooters,
  };
}

// ─── Criteria items (shared) ──────────────────────────────────────────────────

const CRITERIA_ITEMS = [
  'Os valores representam saídas financeiras filtradas conforme os critérios selecionados.',
  'Os subtotais representam a soma de todos os lançamentos de cada agrupamento exibido.',
  'O total geral representa a soma integral de todos os registros listados neste relatório.',
  'Valores formatados em moeda conforme configuração do sistema. Datas no padrão dd/mm/aaaa.',
  'Campos sem informação são exibidos como "-". O relatório foi emitido na data/hora indicada.',
];

// ─── 1. RELATÓRIO GERAL ───────────────────────────────────────────────────────

export function exportSaidasGeralPDF(
  data: RelatorioSaidaItem[],
  filters: SaidasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_saidas = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio = quantidade_total_registros > 0 ? total_geral_saidas / quantidade_total_registros : 0;
  const valores = data.map((item) => safeValue(item.valor));
  const maior_saida = valores.length ? Math.max(...valores) : 0;
  const menor_saida = valores.length ? Math.min(...valores) : 0;

  const issuedAtLabel = formatDateTimeNow();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  // Header
  engine.drawHeader('Relatório Financeiro – Saídas', 'Saídas Financeiras');

  // Info block
  engine.drawInfoBlock([
    { label: 'Período início', value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim', value: filters.periodoFimLabel || 'Todos' },
    { label: 'Status', value: filters.statusLabel || 'Todos' },
    { label: 'Fornecedor', value: filters.fornecedorLabel || 'Todos' },
    { label: 'Projetos', value: filters.projetosLabel || 'Todos' },
    { label: 'Grupo contábil', value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório', value: 'Relatório Geral' },
    { label: 'Qtd. de registros', value: String(quantidade_total_registros) },
  ]);

  // Indicator cards
  engine.drawIndicatorCards([
    { label: 'Total Geral de Saídas', value: formatCurrency(total_geral_saidas), tone: 'rose' },
    { label: 'Quantidade de Lançamentos', value: String(quantidade_total_registros), tone: 'highlight' },
    { label: 'Ticket Médio', value: formatCurrency(ticket_medio), tone: 'default' },
    { label: 'Maior Saída', value: formatCurrency(maior_saida), tone: 'accent' },
    { label: 'Menor Saída', value: formatCurrency(menor_saida), tone: 'default' },
  ]);

  // Executive summary
  const topFornecedor = (() => {
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const k = item.fornecedor_nome || 'N/I';
      map[k] = (map[k] ?? 0) + safeValue(item.valor);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
  })();

  engine.drawExecutiveSummary([
    `No período analisado, foram registradas ${quantidade_total_registros} saída(s), totalizando ${formatCurrency(total_geral_saidas)}.`,
    `O valor médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `A maior concentração de volume ocorreu no fornecedor "${topFornecedor}".`,
    `A maior saída individual registrada foi de ${formatCurrency(maior_saida)}.`,
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  // Detail table
  engine.drawSectionTitle('Detalhamento', 'Lançamentos');

  const columns = [
    { label: 'Nº Doc', width: 18, align: 'left' as const },
    { label: 'Fornecedor', width: 33, align: 'left' as const },
    { label: 'Projeto', width: 28, align: 'left' as const },
    { label: 'Grupo Contábil', width: 27, align: 'left' as const },
    { label: 'Valor', width: 24, align: 'right' as const },
    { label: 'Dt Venc', width: 20, align: 'center' as const },
    { label: 'Dt Pag', width: 20, align: 'center' as const },
    { label: 'Status', width: 12, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawTableHeader(columns, colX);

  data.forEach((item, index) => {
    const valor = safeValue(item.valor);
    const rowH = 8;

    if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
      engine.addPage();
      engine.drawTableHeader(columns, colX);
    }

    setFill(doc, index % 2 === 0 ? COLORS.light : COLORS.white);
    doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

    const ty = engine.y + 5.2;
    setText(doc, COLORS.graphite);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);

    doc.text(truncate(item.numero_documento || '-', 10), colX[0] + 2, ty);
    doc.text(truncate(item.fornecedor_nome || '-', 18), colX[1] + 2, ty);
    doc.text(truncate(item.projeto_nomes || '-', 15), colX[2] + 2, ty);
    doc.text(truncate(item.grupo_contabil || '-', 14), colX[3] + 2, ty);

    setText(doc, COLORS.rose);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(valor), colX[4] + columns[4].width - 2, ty, { align: 'right' });

    setText(doc, COLORS.graphite);
    doc.setFont('helvetica', 'normal');
    doc.text(safeDisplayDate(item.data_vencimento), colX[5] + columns[5].width / 2, ty, { align: 'center' });
    doc.text(safeDisplayDate(item.data_pagamento), colX[6] + columns[6].width / 2, ty, { align: 'center' });

    engine.drawStatusBadge(item.status || '-', colX[7], engine.y);
    engine.y += rowH;
  });

  engine.y += 6;
  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_saidas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_saidas_geral_${dateStr}.pdf`);
}

// ─── 2. POR FORNECEDOR ────────────────────────────────────────────────────────

export function exportSaidasPorFornecedorPDF(
  data: RelatorioSaidaItem[],
  filters: SaidasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_saidas = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio = quantidade_total_registros > 0 ? total_geral_saidas / quantidade_total_registros : 0;
  const valores = data.map((item) => safeValue(item.valor));
  const maior_saida = valores.length ? Math.max(...valores) : 0;

  // Subtotal por fornecedor (explícito)
  const subtotal_por_fornecedor: Record<string, number> = {};
  data.forEach((item) => {
    const k = item.fornecedor_nome || 'Sem Fornecedor';
    subtotal_por_fornecedor[k] = (subtotal_por_fornecedor[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_fornecedores = Object.keys(subtotal_por_fornecedor).length;
  const fornecedor_maior_volume = Object.entries(subtotal_por_fornecedor).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  // Agrupar dados
  const grouped: Record<string, RelatorioSaidaItem[]> = {};
  data.forEach((item) => {
    const k = item.fornecedor_nome || 'Sem Fornecedor';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Saídas por Fornecedor', 'Saídas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início', value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim', value: filters.periodoFimLabel || 'Todos' },
    { label: 'Status', value: filters.statusLabel || 'Todos' },
    { label: 'Fornecedor', value: filters.fornecedorLabel || 'Todos' },
    { label: 'Projetos', value: filters.projetosLabel || 'Todos' },
    { label: 'Grupo contábil', value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório', value: 'Por Fornecedor' },
    { label: 'Qtd. de fornecedores', value: String(quantidade_fornecedores) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Saídas', value: formatCurrency(total_geral_saidas), tone: 'rose' },
    { label: 'Qtd. de Fornecedores', value: String(quantidade_fornecedores), tone: 'highlight' },
    { label: 'Fornecedor Maior Volume', value: fornecedor_maior_volume, tone: 'accent' },
    { label: 'Ticket Médio', value: formatCurrency(ticket_medio), tone: 'default' },
    { label: 'Maior Saída Individual', value: formatCurrency(maior_saida), tone: 'default' },
  ]);

  engine.drawExecutiveSummary([
    `Foram consolidados ${quantidade_total_registros} lançamento(s) de ${quantidade_fornecedores} fornecedor(es), totalizando ${formatCurrency(total_geral_saidas)}.`,
    `O ticket médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `O fornecedor com maior volume de saídas foi "${fornecedor_maior_volume}", com ${formatCurrency(subtotal_por_fornecedor[fornecedor_maior_volume] ?? 0)}.`,
    'Os subtotais por fornecedor representam a soma de todos os lançamentos vinculados a cada um.',
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Nº Doc', width: 20, align: 'left' as const },
    { label: 'Projeto', width: 33, align: 'left' as const },
    { label: 'Grupo Contábil', width: 33, align: 'left' as const },
    { label: 'Valor', width: 26, align: 'right' as const },
    { label: 'Dt Venc', width: 22, align: 'center' as const },
    { label: 'Dt Pag', width: 22, align: 'center' as const },
    { label: 'Status', width: 16, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Fornecedor');

  Object.keys(grouped).sort().forEach((fornecedor) => {
    const items = grouped[fornecedor];
    const subtotal = subtotal_por_fornecedor[fornecedor] ?? 0;

    engine.drawGroupHeader(fornecedor, '', '');
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      const valor = safeValue(item.valor);
      const rowH = 8;

      if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
        engine.addPage();
        engine.drawTableHeader(columns, colX);
      }

      setFill(doc, index % 2 === 0 ? COLORS.light : COLORS.white);
      doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

      const ty = engine.y + 5.2;
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);

      doc.text(truncate(item.numero_documento || '-', 12), colX[0] + 2, ty);
      doc.text(truncate(item.projeto_nomes || '-', 18), colX[1] + 2, ty);
      doc.text(truncate(item.grupo_contabil || '-', 18), colX[2] + 2, ty);

      setText(doc, COLORS.rose);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(valor), colX[3] + columns[3].width - 2, ty, { align: 'right' });

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.text(safeDisplayDate(item.data_vencimento), colX[4] + columns[4].width / 2, ty, { align: 'center' });
      doc.text(safeDisplayDate(item.data_pagamento), colX[5] + columns[5].width / 2, ty, { align: 'center' });

      engine.drawStatusBadge(item.status || '-', colX[6], engine.y);
      engine.y += rowH;
    });

    engine.drawGroupFooter(`Subtotal ${fornecedor}`, formatCurrency(subtotal), items.length, formatCurrency);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_saidas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_saidas_por_fornecedor_${dateStr}.pdf`);
}

// ─── 3. POR MÊS ──────────────────────────────────────────────────────────────

export function exportSaidasPorMesPDF(
  data: RelatorioSaidaItem[],
  filters: SaidasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_saidas = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio = quantidade_total_registros > 0 ? total_geral_saidas / quantidade_total_registros : 0;
  const valores = data.map((item) => safeValue(item.valor));
  const maior_saida = valores.length ? Math.max(...valores) : 0;

  // Subtotal por mês (explícito)
  const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const getMesSortKey = (item: RelatorioSaidaItem): string => {
    const raw = item.data_competencia || item.data_pagamento || item.data_vencimento;
    if (!raw) return '0000-00';
    const clean = String(raw).split('T')[0];
    const d = new Date(clean + 'T00:00:00');
    if (isNaN(d.getTime())) return '0000-00';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const getMesLabel = (sortKey: string): string => {
    if (sortKey === '0000-00') return 'Sem Data';
    const [year, month] = sortKey.split('-');
    return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
  };

  const subtotal_por_mes: Record<string, number> = {};
  data.forEach((item) => {
    const k = getMesKey(item);
    subtotal_por_mes[k] = (subtotal_por_mes[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_meses = Object.keys(subtotal_por_mes).length;
  const mes_maior_volume = Object.entries(subtotal_por_mes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
  const media_mensal = quantidade_meses > 0 ? total_geral_saidas / quantidade_meses : 0;

  const grouped: Record<string, RelatorioSaidaItem[]> = {};
  data.forEach((item) => {
    const k = getMesKey(item);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Saídas por Mês', 'Saídas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início', value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim', value: filters.periodoFimLabel || 'Todos' },
    { label: 'Status', value: filters.statusLabel || 'Todos' },
    { label: 'Fornecedor', value: filters.fornecedorLabel || 'Todos' },
    { label: 'Projetos', value: filters.projetosLabel || 'Todos' },
    { label: 'Tipo de relatório', value: 'Por Mês' },
    { label: 'Qtd. de meses', value: String(quantidade_meses) },
    { label: 'Qtd. de registros', value: String(quantidade_total_registros) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Saídas', value: formatCurrency(total_geral_saidas), tone: 'rose' },
    { label: 'Qtd. de Meses', value: String(quantidade_meses), tone: 'highlight' },
    { label: 'Mês Maior Volume', value: mes_maior_volume, tone: 'accent' },
    { label: 'Média Mensal', value: formatCurrency(media_mensal), tone: 'default' },
    { label: 'Maior Saída Individual', value: formatCurrency(maior_saida), tone: 'default' },
  ]);

  engine.drawExecutiveSummary([
    `Foram registradas ${quantidade_total_registros} saída(s) em ${quantidade_meses} mês/meses, totalizando ${formatCurrency(total_geral_saidas)}.`,
    `A média mensal de saídas foi de ${formatCurrency(media_mensal)} por mês.`,
    `O mês com maior volume de saídas foi ${mes_maior_volume}, com ${formatCurrency(subtotal_por_mes[mes_maior_volume] ?? 0)}.`,
    `A maior saída individual registrada foi de ${formatCurrency(maior_saida)}.`,
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Fornecedor', width: 33, align: 'left' as const },
    { label: 'Projeto', width: 28, align: 'left' as const },
    { label: 'Grupo Contábil', width: 28, align: 'left' as const },
    { label: 'Valor', width: 26, align: 'right' as const },
    { label: 'Dt Venc', width: 21, align: 'center' as const },
    { label: 'Dt Pag', width: 21, align: 'center' as const },
    { label: 'Status', width: 15, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Mês');

  Object.keys(grouped).sort().forEach((mesAno) => {
    const items = grouped[mesAno];
    const subtotal = subtotal_por_mes[mesAno] ?? 0;

    engine.drawGroupHeader(`Mês: ${mesAno}`, '', '');
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      const valor = safeValue(item.valor);
      const rowH = 8;

      if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
        engine.addPage();
        engine.drawTableHeader(columns, colX);
      }

      setFill(doc, index % 2 === 0 ? COLORS.light : COLORS.white);
      doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

      const ty = engine.y + 5.2;
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);

      doc.text(truncate(item.fornecedor_nome || '-', 18), colX[0] + 2, ty);
      doc.text(truncate(item.projeto_nomes || '-', 15), colX[1] + 2, ty);
      doc.text(truncate(item.grupo_contabil || '-', 15), colX[2] + 2, ty);

      setText(doc, COLORS.rose);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(valor), colX[3] + columns[3].width - 2, ty, { align: 'right' });

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.text(safeDisplayDate(item.data_vencimento), colX[4] + columns[4].width / 2, ty, { align: 'center' });
      doc.text(safeDisplayDate(item.data_pagamento), colX[5] + columns[5].width / 2, ty, { align: 'center' });

      engine.drawStatusBadge(item.status || '-', colX[6], engine.y);
      engine.y += rowH;
    });

    engine.drawGroupFooter(`Subtotal ${mesAno}`, formatCurrency(subtotal), items.length, formatCurrency);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_saidas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_saidas_por_mes_${dateStr}.pdf`);
}

// ─── 4. POR PROJETO ───────────────────────────────────────────────────────────

export function exportSaidasPorProjetoPDF(
  data: RelatorioSaidaItem[],
  filters: SaidasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_saidas = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio = quantidade_total_registros > 0 ? total_geral_saidas / quantidade_total_registros : 0;
  const valores = data.map((item) => safeValue(item.valor));
  const maior_saida = valores.length ? Math.max(...valores) : 0;

  const subtotal_por_projeto: Record<string, number> = {};
  data.forEach((item) => {
    const k = item.projeto_nomes || 'Sem Projeto';
    subtotal_por_projeto[k] = (subtotal_por_projeto[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_projetos = Object.keys(subtotal_por_projeto).length;
  const projeto_maior_volume = Object.entries(subtotal_por_projeto).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  const grouped: Record<string, RelatorioSaidaItem[]> = {};
  data.forEach((item) => {
    const k = item.projeto_nomes || 'Sem Projeto';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Saídas por Projeto', 'Saídas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início', value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim', value: filters.periodoFimLabel || 'Todos' },
    { label: 'Status', value: filters.statusLabel || 'Todos' },
    { label: 'Fornecedor', value: filters.fornecedorLabel || 'Todos' },
    { label: 'Projetos', value: filters.projetosLabel || 'Todos' },
    { label: 'Grupo contábil', value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório', value: 'Por Projeto' },
    { label: 'Qtd. de projetos', value: String(quantidade_projetos) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Saídas', value: formatCurrency(total_geral_saidas), tone: 'rose' },
    { label: 'Qtd. de Projetos', value: String(quantidade_projetos), tone: 'highlight' },
    { label: 'Projeto Maior Volume', value: projeto_maior_volume, tone: 'accent' },
    { label: 'Ticket Médio', value: formatCurrency(ticket_medio), tone: 'default' },
    { label: 'Maior Saída Individual', value: formatCurrency(maior_saida), tone: 'default' },
  ]);

  engine.drawExecutiveSummary([
    `Foram consolidados ${quantidade_total_registros} lançamento(s) distribuídos em ${quantidade_projetos} projeto(s), totalizando ${formatCurrency(total_geral_saidas)}.`,
    `O ticket médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `O projeto com maior volume de saídas foi "${projeto_maior_volume}", com ${formatCurrency(subtotal_por_projeto[projeto_maior_volume] ?? 0)}.`,
    'Os subtotais por projeto representam a soma de todos os lançamentos associados a cada projeto.',
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Fornecedor', width: 33, align: 'left' as const },
    { label: 'Nº Doc', width: 20, align: 'left' as const },
    { label: 'Grupo Contábil', width: 30, align: 'left' as const },
    { label: 'Valor', width: 26, align: 'right' as const },
    { label: 'Dt Venc', width: 22, align: 'center' as const },
    { label: 'Dt Pag', width: 22, align: 'center' as const },
    { label: 'Status', width: 15, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Projeto');

  Object.keys(grouped).sort().forEach((projeto) => {
    const items = grouped[projeto];
    const subtotal = subtotal_por_projeto[projeto] ?? 0;

    engine.drawGroupHeader(projeto, '', '');
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      const valor = safeValue(item.valor);
      const rowH = 8;

      if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
        engine.addPage();
        engine.drawTableHeader(columns, colX);
      }

      setFill(doc, index % 2 === 0 ? COLORS.light : COLORS.white);
      doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

      const ty = engine.y + 5.2;
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);

      doc.text(truncate(item.fornecedor_nome || '-', 18), colX[0] + 2, ty);
      doc.text(truncate(item.numero_documento || '-', 12), colX[1] + 2, ty);
      doc.text(truncate(item.grupo_contabil || '-', 16), colX[2] + 2, ty);

      setText(doc, COLORS.rose);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(valor), colX[3] + columns[3].width - 2, ty, { align: 'right' });

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.text(safeDisplayDate(item.data_vencimento), colX[4] + columns[4].width / 2, ty, { align: 'center' });
      doc.text(safeDisplayDate(item.data_pagamento), colX[5] + columns[5].width / 2, ty, { align: 'center' });

      engine.drawStatusBadge(item.status || '-', colX[6], engine.y);
      engine.y += rowH;
    });

    engine.drawGroupFooter(`Subtotal ${projeto}`, formatCurrency(subtotal), items.length, formatCurrency);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_saidas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_saidas_por_projeto_${dateStr}.pdf`);
}

// ─── 5. POR GRUPO CONTÁBIL ────────────────────────────────────────────────────

export function exportSaidasPorGrupoPDF(
  data: RelatorioSaidaItem[],
  filters: SaidasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_saidas = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio = quantidade_total_registros > 0 ? total_geral_saidas / quantidade_total_registros : 0;
  const valores = data.map((item) => safeValue(item.valor));
  const maior_saida = valores.length ? Math.max(...valores) : 0;

  const subtotal_por_grupo_contabil: Record<string, number> = {};
  data.forEach((item) => {
    const k = item.grupo_contabil || 'Sem Grupo Contábil';
    subtotal_por_grupo_contabil[k] = (subtotal_por_grupo_contabil[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_grupos = Object.keys(subtotal_por_grupo_contabil).length;
  const grupo_maior_volume = Object.entries(subtotal_por_grupo_contabil).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  const grouped: Record<string, RelatorioSaidaItem[]> = {};
  data.forEach((item) => {
    const k = item.grupo_contabil || 'Sem Grupo Contábil';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Saídas por Grupo Contábil', 'Saídas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início', value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim', value: filters.periodoFimLabel || 'Todos' },
    { label: 'Status', value: filters.statusLabel || 'Todos' },
    { label: 'Fornecedor', value: filters.fornecedorLabel || 'Todos' },
    { label: 'Projetos', value: filters.projetosLabel || 'Todos' },
    { label: 'Grupo contábil', value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório', value: 'Por Grupo Contábil' },
    { label: 'Qtd. de grupos', value: String(quantidade_grupos) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Saídas', value: formatCurrency(total_geral_saidas), tone: 'rose' },
    { label: 'Qtd. de Grupos Contábeis', value: String(quantidade_grupos), tone: 'highlight' },
    { label: 'Grupo Maior Volume', value: grupo_maior_volume, tone: 'accent' },
    { label: 'Ticket Médio', value: formatCurrency(ticket_medio), tone: 'default' },
    { label: 'Maior Saída Individual', value: formatCurrency(maior_saida), tone: 'default' },
  ]);

  engine.drawExecutiveSummary([
    `Foram consolidados ${quantidade_total_registros} lançamento(s) em ${quantidade_grupos} grupo(s) contábil(is), totalizando ${formatCurrency(total_geral_saidas)}.`,
    `O ticket médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `O grupo contábil com maior volume foi "${grupo_maior_volume}", com ${formatCurrency(subtotal_por_grupo_contabil[grupo_maior_volume] ?? 0)}.`,
    'Os subtotais por grupo representam a soma de todos os lançamentos classificados em cada grupo.',
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Fornecedor', width: 33, align: 'left' as const },
    { label: 'Projeto', width: 30, align: 'left' as const },
    { label: 'Nº Doc', width: 20, align: 'left' as const },
    { label: 'Valor', width: 26, align: 'right' as const },
    { label: 'Dt Venc', width: 22, align: 'center' as const },
    { label: 'Dt Pag', width: 22, align: 'center' as const },
    { label: 'Status', width: 15, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Grupo Contábil');

  Object.keys(grouped).sort().forEach((grupo) => {
    const items = grouped[grupo];
    const subtotal = subtotal_por_grupo_contabil[grupo] ?? 0;

    engine.drawGroupHeader(grupo, '', '');
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      const valor = safeValue(item.valor);
      const rowH = 8;

      if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
        engine.addPage();
        engine.drawTableHeader(columns, colX);
      }

      setFill(doc, index % 2 === 0 ? COLORS.light : COLORS.white);
      doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

      const ty = engine.y + 5.2;
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);

      doc.text(truncate(item.fornecedor_nome || '-', 18), colX[0] + 2, ty);
      doc.text(truncate(item.projeto_nomes || '-', 16), colX[1] + 2, ty);
      doc.text(truncate(item.numero_documento || '-', 12), colX[2] + 2, ty);

      setText(doc, COLORS.rose);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(valor), colX[3] + columns[3].width - 2, ty, { align: 'right' });

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.text(safeDisplayDate(item.data_vencimento), colX[4] + columns[4].width / 2, ty, { align: 'center' });
      doc.text(safeDisplayDate(item.data_pagamento), colX[5] + columns[5].width / 2, ty, { align: 'center' });

      engine.drawStatusBadge(item.status || '-', colX[6], engine.y);
      engine.y += rowH;
    });

    engine.drawGroupFooter(`Subtotal ${grupo}`, formatCurrency(subtotal), items.length, formatCurrency);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_saidas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_saidas_por_grupo_${sanitizeFilename(grupo_maior_volume)}_${dateStr}.pdf`);
}
