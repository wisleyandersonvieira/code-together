import jsPDF from 'jspdf';

export interface RelatorioEntradaItem {
  numero_documento?: string;
  cliente_nome: string;
  matriz_nome?: string;
  projeto_nomes?: string;
  valor: number;
  data_recebimento?: string;
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

export interface EntradasExportFilters {
  periodoInicioLabel?: string;
  periodoFimLabel?: string;
  statusLabel?: string;
  clienteLabel?: string;
  matrizLabel?: string;
  projetosLabel?: string;
  grupoContabilLabel?: string;
}

type ExportContext = {
  formatCurrency: (value: number) => string;
};

type RgbColor = [number, number, number];

const COLORS = {
  navy:      [17,  31,  59]  as RgbColor,
  navySoft:  [229, 236, 246] as RgbColor,
  graphite:  [59,  68,  82]  as RgbColor,
  slate:     [107, 114, 128] as RgbColor,
  border:    [217, 223, 232] as RgbColor,
  light:     [245, 247, 250] as RgbColor,
  white:     [255, 255, 255] as RgbColor,
  green:     [22,  101, 52]  as RgbColor,
  greenSoft: [236, 253, 245] as RgbColor,
  gold:      [146, 103, 33]  as RgbColor,
  goldSoft:  [255, 251, 235] as RgbColor,
  blue:      [29,  78,  216] as RgbColor,
  blueSoft:  [239, 246, 255] as RgbColor,
  rose:      [190, 24,  93]  as RgbColor,
  roseSoft:  [255, 241, 242] as RgbColor,
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
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(now);
  const timePart = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit',
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

function truncate(text: string, max: number): string {
  if (!text) return '-';
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

function drawProvisionLogo(doc: jsPDF, x: number, y: number, size: number, color: RgbColor) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const innerRadius  = size * 0.08;
  const outerDistance = size * 0.31;
  const outerRadius  = size * 0.065;

  setDraw(doc, color);
  setFill(doc, color);
  doc.setLineWidth(0.8);

  const points = [
    { dx: 0,                     dy: -outerDistance            },
    { dx:  outerDistance * 0.72, dy: -outerDistance * 0.72     },
    { dx:  outerDistance,        dy: 0                         },
    { dx:  outerDistance * 0.72, dy:  outerDistance * 0.72     },
    { dx: 0,                     dy:  outerDistance            },
    { dx: -outerDistance * 0.72, dy:  outerDistance * 0.72     },
    { dx: -outerDistance,        dy: 0                         },
    { dx: -outerDistance * 0.72, dy: -outerDistance * 0.72     },
  ];

  points.forEach((point) => {
    doc.line(centerX, centerY, centerX + point.dx, centerY + point.dy);
    doc.circle(centerX + point.dx, centerY + point.dy, outerRadius, 'FD');
  });

  doc.circle(centerX, centerY, innerRadius, 'FD');
}

// ─── PDF engine (shared primitives) ──────────────────────────────────────────

function makePdfEngine(doc: jsPDF, issuedAtLabel: string) {
  const pageWidth    = doc.internal.pageSize.width;
  const pageHeight   = doc.internal.pageSize.height;
  const marginX      = 14;
  const contentWidth = pageWidth - marginX * 2;
  const topStart     = 14;
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

    const gap      = 5;
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
      const x        = marginX + colIndex * (colWidth + gap);
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
        ? { bg: COLORS.greenSoft,  text: COLORS.green,    border: COLORS.border }
        : tone === 'highlight'
          ? { bg: COLORS.navySoft, text: COLORS.navy,     border: COLORS.navy   }
          : tone === 'accent'
            ? { bg: COLORS.goldSoft, text: COLORS.gold,   border: COLORS.border }
            : tone === 'rose'
              ? { bg: COLORS.roseSoft, text: COLORS.rose, border: COLORS.border }
              : { bg: COLORS.white,  text: COLORS.graphite, border: COLORS.border };

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

    const gap       = 4;
    const cols      = 2;
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

  const drawTableHeader = (
    columns: { label: string; width: number; align: 'left' | 'right' | 'center' }[],
    colX: number[],
  ) => {
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

  const drawStatusBadge = (status: string, x: number, rowY: number) => {
    const isRecebido = status === 'RECEBIDO';
    const bg = isRecebido ? COLORS.greenSoft : COLORS.goldSoft;
    const fg = isRecebido ? COLORS.green     : COLORS.gold;
    const w  = 20;

    setFill(doc, bg);
    doc.roundedRect(x, rowY + 1.5, w, 5, 2, 2, 'F');
    setText(doc, fg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(status, x + w / 2, rowY + 5, { align: 'center' });
  };

  const drawGroupHeader = (label: string) => {
    ensureSpace(10);
    setFill(doc, COLORS.navySoft);
    setDraw(doc, COLORS.border);
    doc.roundedRect(marginX, y, contentWidth, 8, 2, 2, 'FD');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, marginX + 4, y + 5.5);
    y += 10;
  };

  const drawGroupFooter = (subtotalLabel: string, subtotalValue: string, count: number) => {
    ensureSpace(12);
    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);
    doc.roundedRect(marginX, y, contentWidth, 9, 2, 2, 'FD');

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${subtotalLabel} — ${count} lançamento(s)`, marginX + 4, y + 6);

    setText(doc, COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(subtotalValue, pageWidth - marginX - 4, y + 6, { align: 'right' });

    y += 12;
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

    const gap      = 4;
    const colWidth = (contentWidth - gap) / 2;
    const heights  = items.map((item) => {
      const lines = doc.splitTextToSize(item, colWidth - 10);
      return Math.max(16, 9 + lines.length * 4.4);
    });

    let localY = y;
    items.forEach((item, index) => {
      if (index % 2 === 0) ensureSpace(Math.max(heights[index], heights[index + 1] ?? 0) + 4);
      const x      = marginX + (index % 2) * (colWidth + gap);
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
    drawStatusBadge,
    drawGroupHeader,
    drawGroupFooter,
    drawGrandTotal,
    drawCriteria,
    drawFooters,
  };
}

// ─── Critérios compartilhados ─────────────────────────────────────────────────

const CRITERIA_ITEMS = [
  'Os valores representam entradas financeiras filtradas conforme os critérios selecionados.',
  'Os subtotais representam a soma de todos os lançamentos de cada agrupamento exibido.',
  'O total geral representa a soma integral de todos os registros listados neste relatório.',
  'Valores formatados em moeda conforme configuração do sistema. Datas no padrão dd/mm/aaaa.',
  'Campos sem informação são exibidos como "-". O relatório foi emitido na data/hora indicada.',
];

// ─── Helpers de renderização de linha ────────────────────────────────────────

function renderEntradaRow(
  doc: jsPDF,
  engine: ReturnType<typeof makePdfEngine>,
  item: RelatorioEntradaItem,
  columns: { label: string; width: number; align: 'left' | 'right' | 'center' }[],
  colX: number[],
  index: number,
  formatCurrency: (v: number) => string,
  colIdxValor: number,
  colIdxVenc: number,
  colIdxRec: number,
  colIdxStatus: number,
  colIdxExtra: { [key: string]: number },
) {
  const valor  = safeValue(item.valor);
  const rowH   = 8;

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

  // Extra text columns
  Object.entries(colIdxExtra).forEach(([field, ci]) => {
    let val = '-';
    if (field === 'numero_documento') val = truncate(item.numero_documento || '-', 12);
    else if (field === 'cliente_nome')  val = truncate(item.cliente_nome   || '-', 18);
    else if (field === 'projeto_nomes') val = truncate(item.projeto_nomes  || '-', 18);
    else if (field === 'grupo_contabil') val = truncate(item.grupo_contabil || '-', 18);
    const col = columns[ci];
    const cx  = col.align === 'right'
      ? colX[ci] + col.width - 2
      : col.align === 'center'
        ? colX[ci] + col.width / 2
        : colX[ci] + 2;
    doc.text(val, cx, ty, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' });
  });

  // Valor
  setText(doc, COLORS.green);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(valor), colX[colIdxValor] + columns[colIdxValor].width - 2, ty, { align: 'right' });

  // Datas
  setText(doc, COLORS.graphite);
  doc.setFont('helvetica', 'normal');
  doc.text(safeDisplayDate(item.data_vencimento),  colX[colIdxVenc]   + columns[colIdxVenc].width   / 2, ty, { align: 'center' });
  doc.text(safeDisplayDate(item.data_recebimento), colX[colIdxRec]    + columns[colIdxRec].width    / 2, ty, { align: 'center' });

  // Status badge
  engine.drawStatusBadge(item.status || '-', colX[colIdxStatus], engine.y);
  engine.y += rowH;
}

// ─── 1. RELATÓRIO GERAL ───────────────────────────────────────────────────────

export function exportEntradasGeralPDF(
  data: RelatorioEntradaItem[],
  filters: EntradasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_entradas       = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio               = quantidade_total_registros > 0 ? total_geral_entradas / quantidade_total_registros : 0;
  const valores                    = data.map((item) => safeValue(item.valor));
  const maior_entrada              = valores.length ? Math.max(...valores) : 0;
  const menor_entrada              = valores.length ? Math.min(...valores) : 0;

  const topCliente = (() => {
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const k = item.cliente_nome || 'N/I';
      map[k] = (map[k] ?? 0) + safeValue(item.valor);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
  })();

  const issuedAtLabel = formatDateTimeNow();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  // ── Cabeçalho ──
  engine.drawHeader('Relatório Financeiro – Entradas', 'Entradas Financeiras');

  // ── Bloco de identificação ──
  engine.drawInfoBlock([
    { label: 'Período início',     value: filters.periodoInicioLabel  || 'Todos' },
    { label: 'Período fim',        value: filters.periodoFimLabel     || 'Todos' },
    { label: 'Status',             value: filters.statusLabel         || 'Todos' },
    { label: 'Cliente',            value: filters.clienteLabel        || 'Todos' },
    { label: 'Projetos',           value: filters.projetosLabel       || 'Todos' },
    { label: 'Grupo contábil',     value: filters.grupoContabilLabel  || 'Todos' },
    { label: 'Tipo de relatório',  value: 'Relatório Geral'           },
    { label: 'Qtd. de registros',  value: String(quantidade_total_registros) },
  ]);

  // ── Painel executivo ──
  engine.drawIndicatorCards([
    { label: 'Total Geral de Entradas',    value: formatCurrency(total_geral_entradas), tone: 'positive'  },
    { label: 'Quantidade de Lançamentos',  value: String(quantidade_total_registros),   tone: 'highlight' },
    { label: 'Ticket Médio',               value: formatCurrency(ticket_medio),         tone: 'default'   },
    { label: 'Maior Entrada',              value: formatCurrency(maior_entrada),         tone: 'accent'    },
    { label: 'Menor Entrada',              value: formatCurrency(menor_entrada),         tone: 'default'   },
  ]);

  // ── Leitura executiva ──
  engine.drawExecutiveSummary([
    `No período analisado, foram registradas ${quantidade_total_registros} entrada(s), totalizando ${formatCurrency(total_geral_entradas)}.`,
    `O valor médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `A maior concentração de volume ocorreu no cliente "${topCliente}".`,
    `A maior entrada individual registrada foi de ${formatCurrency(maior_entrada)}.`,
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  // ── Detalhamento ──
  engine.drawSectionTitle('Detalhamento', 'Lançamentos');

  const columns = [
    { label: 'Nº Doc',         width: 18, align: 'left'   as const },
    { label: 'Cliente',        width: 34, align: 'left'   as const },
    { label: 'Projeto',        width: 27, align: 'left'   as const },
    { label: 'Grupo Contábil', width: 27, align: 'left'   as const },
    { label: 'Valor',          width: 24, align: 'right'  as const },
    { label: 'Dt Venc',        width: 20, align: 'center' as const },
    { label: 'Dt Rec',         width: 20, align: 'center' as const },
    { label: 'Status',         width: 12, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawTableHeader(columns, colX);

  data.forEach((item, index) => {
    renderEntradaRow(doc, engine, item, columns, colX, index, formatCurrency,
      4, 5, 6, 7,
      { numero_documento: 0, cliente_nome: 1, projeto_nomes: 2, grupo_contabil: 3 },
    );
  });

  engine.y += 6;
  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_entradas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  doc.save(`relatorio_entradas_geral_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── 2. POR CLIENTE ───────────────────────────────────────────────────────────

export function exportEntradasPorClientePDF(
  data: RelatorioEntradaItem[],
  filters: EntradasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_entradas       = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio               = quantidade_total_registros > 0 ? total_geral_entradas / quantidade_total_registros : 0;
  const valores                    = data.map((item) => safeValue(item.valor));
  const maior_entrada              = valores.length ? Math.max(...valores) : 0;

  // Subtotal por cliente (explícito — nunca usa último item do grupo)
  const subtotal_por_cliente: Record<string, number> = {};
  data.forEach((item) => {
    const k = item.cliente_nome || 'Sem Cliente';
    subtotal_por_cliente[k] = (subtotal_por_cliente[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_clientes      = Object.keys(subtotal_por_cliente).length;
  const cliente_maior_volume     = Object.entries(subtotal_por_cliente).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  // Agrupamento
  const grouped: Record<string, RelatorioEntradaItem[]> = {};
  data.forEach((item) => {
    const k = item.cliente_nome || 'Sem Cliente';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Entradas por Cliente', 'Entradas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início',      value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim',         value: filters.periodoFimLabel    || 'Todos' },
    { label: 'Status',              value: filters.statusLabel        || 'Todos' },
    { label: 'Cliente',             value: filters.clienteLabel       || 'Todos' },
    { label: 'Projetos',            value: filters.projetosLabel      || 'Todos' },
    { label: 'Grupo contábil',      value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório',   value: 'Por Cliente'              },
    { label: 'Qtd. de clientes',    value: String(quantidade_clientes) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Entradas',   value: formatCurrency(total_geral_entradas), tone: 'positive'  },
    { label: 'Qtd. de Clientes',          value: String(quantidade_clientes),          tone: 'highlight' },
    { label: 'Cliente Maior Volume',       value: cliente_maior_volume,                tone: 'accent'    },
    { label: 'Ticket Médio',              value: formatCurrency(ticket_medio),         tone: 'default'   },
    { label: 'Maior Entrada Individual',  value: formatCurrency(maior_entrada),        tone: 'default'   },
  ]);

  engine.drawExecutiveSummary([
    `Foram consolidados ${quantidade_total_registros} lançamento(s) de ${quantidade_clientes} cliente(s), totalizando ${formatCurrency(total_geral_entradas)}.`,
    `O ticket médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `O cliente com maior volume de entradas foi "${cliente_maior_volume}", com ${formatCurrency(subtotal_por_cliente[cliente_maior_volume] ?? 0)}.`,
    'Os subtotais por cliente representam a soma de todos os lançamentos vinculados a cada um.',
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Nº Doc',         width: 20, align: 'left'   as const },
    { label: 'Projeto',        width: 36, align: 'left'   as const },
    { label: 'Grupo Contábil', width: 34, align: 'left'   as const },
    { label: 'Valor',          width: 26, align: 'right'  as const },
    { label: 'Dt Venc',        width: 22, align: 'center' as const },
    { label: 'Dt Rec',         width: 22, align: 'center' as const },
    { label: 'Status',         width: 22, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Cliente');

  Object.keys(grouped).sort().forEach((cliente) => {
    const items    = grouped[cliente];
    const subtotal = subtotal_por_cliente[cliente] ?? 0;

    engine.drawGroupHeader(cliente);
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      renderEntradaRow(doc, engine, item, columns, colX, index, formatCurrency,
        3, 4, 5, 6,
        { numero_documento: 0, projeto_nomes: 1, grupo_contabil: 2 },
      );
    });

    engine.drawGroupFooter(`Subtotal ${cliente}`, formatCurrency(subtotal), items.length);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_entradas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  doc.save(`relatorio_entradas_por_cliente_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── 3. POR MÊS ──────────────────────────────────────────────────────────────

export function exportEntradasPorMesPDF(
  data: RelatorioEntradaItem[],
  filters: EntradasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_entradas       = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const valores                    = data.map((item) => safeValue(item.valor));
  const maior_entrada              = valores.length ? Math.max(...valores) : 0;

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  const getMesSortKey = (item: RelatorioEntradaItem): string => {
    // Usar data de competência > recebimento > vencimento (nesta ordem de prioridade)
    const raw = item.data_competencia || item.data_recebimento || item.data_vencimento;
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

  // Subtotal por mês (explícito)
  const subtotal_por_mes: Record<string, number> = {};
  data.forEach((item) => {
    const k = getMesSortKey(item);
    subtotal_por_mes[k] = (subtotal_por_mes[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_meses         = Object.keys(subtotal_por_mes).length;
  const mes_maior_volume_key     = Object.entries(subtotal_por_mes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';
  const mes_maior_volume         = mes_maior_volume_key !== '-' ? getMesLabel(mes_maior_volume_key) : '-';
  const media_mensal             = quantidade_meses > 0 ? total_geral_entradas / quantidade_meses : 0;

  const grouped: Record<string, RelatorioEntradaItem[]> = {};
  data.forEach((item) => {
    const k = getMesSortKey(item);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Entradas por Mês', 'Entradas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início',     value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim',        value: filters.periodoFimLabel    || 'Todos' },
    { label: 'Status',             value: filters.statusLabel        || 'Todos' },
    { label: 'Cliente',            value: filters.clienteLabel       || 'Todos' },
    { label: 'Projetos',           value: filters.projetosLabel      || 'Todos' },
    { label: 'Tipo de relatório',  value: 'Por Mês'                  },
    { label: 'Qtd. de meses',      value: String(quantidade_meses)   },
    { label: 'Qtd. de registros',  value: String(quantidade_total_registros) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Entradas',   value: formatCurrency(total_geral_entradas), tone: 'positive'  },
    { label: 'Qtd. de Meses',             value: String(quantidade_meses),             tone: 'highlight' },
    { label: 'Mês com Maior Volume',       value: mes_maior_volume,                   tone: 'accent'    },
    { label: 'Média Mensal',              value: formatCurrency(media_mensal),         tone: 'default'   },
    { label: 'Maior Entrada Individual',  value: formatCurrency(maior_entrada),        tone: 'default'   },
  ]);

  engine.drawExecutiveSummary([
    `Foram registradas ${quantidade_total_registros} entrada(s) em ${quantidade_meses} mês/meses, totalizando ${formatCurrency(total_geral_entradas)}.`,
    `A média mensal de entradas foi de ${formatCurrency(media_mensal)} por mês.`,
    `O mês com maior volume de entradas foi ${mes_maior_volume}, com ${formatCurrency(subtotal_por_mes[mes_maior_volume_key] ?? 0)}.`,
    `A maior entrada individual registrada foi de ${formatCurrency(maior_entrada)}.`,
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Cliente',        width: 34, align: 'left'   as const },
    { label: 'Projeto',        width: 28, align: 'left'   as const },
    { label: 'Grupo Contábil', width: 28, align: 'left'   as const },
    { label: 'Valor',          width: 26, align: 'right'  as const },
    { label: 'Dt Venc',        width: 21, align: 'center' as const },
    { label: 'Dt Rec',         width: 21, align: 'center' as const },
    { label: 'Status',         width: 24, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Mês');

  Object.keys(grouped).sort().forEach((sortKey) => {
    const mesLabel = getMesLabel(sortKey);
    const items    = grouped[sortKey];
    const subtotal = subtotal_por_mes[sortKey] ?? 0;

    engine.drawGroupHeader(`Mês: ${mesLabel}`);
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      renderEntradaRow(doc, engine, item, columns, colX, index, formatCurrency,
        3, 4, 5, 6,
        { cliente_nome: 0, projeto_nomes: 1, grupo_contabil: 2 },
      );
    });

    engine.drawGroupFooter(`Subtotal ${mesLabel}`, formatCurrency(subtotal), items.length);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_entradas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  doc.save(`relatorio_entradas_por_mes_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── 4. POR PROJETO ───────────────────────────────────────────────────────────

export function exportEntradasPorProjetoPDF(
  data: RelatorioEntradaItem[],
  filters: EntradasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_entradas       = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio               = quantidade_total_registros > 0 ? total_geral_entradas / quantidade_total_registros : 0;
  const valores                    = data.map((item) => safeValue(item.valor));
  const maior_entrada              = valores.length ? Math.max(...valores) : 0;

  // Subtotal por projeto (explícito)
  const subtotal_por_projeto: Record<string, number> = {};
  data.forEach((item) => {
    const k = item.projeto_nomes || 'Sem Projeto';
    subtotal_por_projeto[k] = (subtotal_por_projeto[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_projetos    = Object.keys(subtotal_por_projeto).length;
  const projeto_maior_volume   = Object.entries(subtotal_por_projeto).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  const grouped: Record<string, RelatorioEntradaItem[]> = {};
  data.forEach((item) => {
    const k = item.projeto_nomes || 'Sem Projeto';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Entradas por Projeto', 'Entradas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início',     value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim',        value: filters.periodoFimLabel    || 'Todos' },
    { label: 'Status',             value: filters.statusLabel        || 'Todos' },
    { label: 'Cliente',            value: filters.clienteLabel       || 'Todos' },
    { label: 'Projetos',           value: filters.projetosLabel      || 'Todos' },
    { label: 'Grupo contábil',     value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório',  value: 'Por Projeto'              },
    { label: 'Qtd. de projetos',   value: String(quantidade_projetos) },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Entradas',   value: formatCurrency(total_geral_entradas), tone: 'positive'  },
    { label: 'Qtd. de Projetos',          value: String(quantidade_projetos),          tone: 'highlight' },
    { label: 'Projeto Maior Volume',       value: projeto_maior_volume,               tone: 'accent'    },
    { label: 'Ticket Médio',              value: formatCurrency(ticket_medio),         tone: 'default'   },
    { label: 'Maior Entrada Individual',  value: formatCurrency(maior_entrada),        tone: 'default'   },
  ]);

  engine.drawExecutiveSummary([
    `Foram consolidados ${quantidade_total_registros} lançamento(s) distribuídos em ${quantidade_projetos} projeto(s), totalizando ${formatCurrency(total_geral_entradas)}.`,
    `O ticket médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `O projeto com maior volume de entradas foi "${projeto_maior_volume}", com ${formatCurrency(subtotal_por_projeto[projeto_maior_volume] ?? 0)}.`,
    'Os subtotais por projeto representam a soma de todos os lançamentos associados a cada projeto.',
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Cliente',        width: 34, align: 'left'   as const },
    { label: 'Nº Doc',         width: 20, align: 'left'   as const },
    { label: 'Grupo Contábil', width: 30, align: 'left'   as const },
    { label: 'Valor',          width: 26, align: 'right'  as const },
    { label: 'Dt Venc',        width: 22, align: 'center' as const },
    { label: 'Dt Rec',         width: 22, align: 'center' as const },
    { label: 'Status',         width: 28, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Projeto');

  Object.keys(grouped).sort().forEach((projeto) => {
    const items    = grouped[projeto];
    const subtotal = subtotal_por_projeto[projeto] ?? 0;

    engine.drawGroupHeader(projeto);
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      renderEntradaRow(doc, engine, item, columns, colX, index, formatCurrency,
        3, 4, 5, 6,
        { cliente_nome: 0, numero_documento: 1, grupo_contabil: 2 },
      );
    });

    engine.drawGroupFooter(`Subtotal ${projeto}`, formatCurrency(subtotal), items.length);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_entradas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  doc.save(`relatorio_entradas_por_projeto_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── 5. POR GRUPO CONTÁBIL ────────────────────────────────────────────────────

export function exportEntradasPorGrupoPDF(
  data: RelatorioEntradaItem[],
  filters: EntradasExportFilters,
  { formatCurrency }: ExportContext,
) {
  if (!data.length) return;

  // ── Cálculos intermediários explícitos ──
  const quantidade_total_registros = data.length;
  const total_geral_entradas       = data.reduce((sum, item) => sum + safeValue(item.valor), 0);
  const ticket_medio               = quantidade_total_registros > 0 ? total_geral_entradas / quantidade_total_registros : 0;
  const valores                    = data.map((item) => safeValue(item.valor));
  const maior_entrada              = valores.length ? Math.max(...valores) : 0;

  // Subtotal por grupo contábil (explícito)
  const subtotal_por_grupo_contabil: Record<string, number> = {};
  data.forEach((item) => {
    const k = item.grupo_contabil || 'Sem Grupo Contábil';
    subtotal_por_grupo_contabil[k] = (subtotal_por_grupo_contabil[k] ?? 0) + safeValue(item.valor);
  });

  const quantidade_grupos    = Object.keys(subtotal_por_grupo_contabil).length;
  const grupo_maior_volume   = Object.entries(subtotal_por_grupo_contabil).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  const grouped: Record<string, RelatorioEntradaItem[]> = {};
  data.forEach((item) => {
    const k = item.grupo_contabil || 'Sem Grupo Contábil';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });

  const issuedAtLabel = formatDateTimeNow();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  engine.drawHeader('Relatório de Entradas por Grupo Contábil', 'Entradas Financeiras');

  engine.drawInfoBlock([
    { label: 'Período início',     value: filters.periodoInicioLabel || 'Todos' },
    { label: 'Período fim',        value: filters.periodoFimLabel    || 'Todos' },
    { label: 'Status',             value: filters.statusLabel        || 'Todos' },
    { label: 'Cliente',            value: filters.clienteLabel       || 'Todos' },
    { label: 'Projetos',           value: filters.projetosLabel      || 'Todos' },
    { label: 'Grupo contábil',     value: filters.grupoContabilLabel || 'Todos' },
    { label: 'Tipo de relatório',  value: 'Por Grupo Contábil'       },
    { label: 'Qtd. de grupos',     value: String(quantidade_grupos)  },
  ]);

  engine.drawIndicatorCards([
    { label: 'Total Geral de Entradas',   value: formatCurrency(total_geral_entradas), tone: 'positive'  },
    { label: 'Qtd. de Grupos Contábeis',  value: String(quantidade_grupos),            tone: 'highlight' },
    { label: 'Grupo Maior Volume',         value: grupo_maior_volume,                 tone: 'accent'    },
    { label: 'Ticket Médio',              value: formatCurrency(ticket_medio),         tone: 'default'   },
    { label: 'Maior Entrada Individual',  value: formatCurrency(maior_entrada),        tone: 'default'   },
  ]);

  engine.drawExecutiveSummary([
    `Foram consolidados ${quantidade_total_registros} lançamento(s) em ${quantidade_grupos} grupo(s) contábil(is), totalizando ${formatCurrency(total_geral_entradas)}.`,
    `O ticket médio por lançamento foi de ${formatCurrency(ticket_medio)}.`,
    `O grupo contábil com maior volume foi "${grupo_maior_volume}", com ${formatCurrency(subtotal_por_grupo_contabil[grupo_maior_volume] ?? 0)}.`,
    'Os subtotais por grupo representam a soma de todos os lançamentos classificados em cada grupo.',
    'Os dados refletem exclusivamente os lançamentos filtrados conforme os critérios selecionados.',
  ]);

  const columns = [
    { label: 'Cliente',  width: 34, align: 'left'   as const },
    { label: 'Projeto',  width: 31, align: 'left'   as const },
    { label: 'Nº Doc',   width: 20, align: 'left'   as const },
    { label: 'Valor',    width: 26, align: 'right'  as const },
    { label: 'Dt Venc',  width: 22, align: 'center' as const },
    { label: 'Dt Rec',   width: 22, align: 'center' as const },
    { label: 'Status',   width: 27, align: 'center' as const },
  ];

  const colX: number[] = [];
  let rx = engine.marginX;
  columns.forEach((col) => { colX.push(rx); rx += col.width; });

  engine.drawSectionTitle('Detalhamento', 'Lançamentos por Grupo Contábil');

  Object.keys(grouped).sort().forEach((grupo) => {
    const items    = grouped[grupo];
    const subtotal = subtotal_por_grupo_contabil[grupo] ?? 0;

    engine.drawGroupHeader(grupo);
    engine.drawTableHeader(columns, colX);

    items.forEach((item, index) => {
      renderEntradaRow(doc, engine, item, columns, colX, index, formatCurrency,
        3, 4, 5, 6,
        { cliente_nome: 0, projeto_nomes: 1, numero_documento: 2 },
      );
    });

    engine.drawGroupFooter(`Subtotal ${grupo}`, formatCurrency(subtotal), items.length);
  });

  engine.drawGrandTotal('Total Geral', formatCurrency(total_geral_entradas), quantidade_total_registros);
  engine.drawCriteria(CRITERIA_ITEMS);
  engine.drawFooters();

  doc.save(`relatorio_entradas_por_grupo_${new Date().toISOString().slice(0, 10)}.pdf`);
}
