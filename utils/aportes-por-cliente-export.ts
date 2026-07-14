import jsPDF from 'jspdf';

export interface AporteProjetoItem {
  nome: string;
  status?: string | null;
  realizado: number;
  previsto: number;
}

export interface AporteClienteItem {
  membro_nome: string;
  membro_tipo: 'cliente' | 'empresa' | 'grupo';
  total_realizado: number;
  total_previsto: number;
  projetos: AporteProjetoItem[];
}

export interface AportesPorClienteResumo {
  qtdClientes: number;
  totalRealizado: number;
  totalPrevisto: number;
  qtdProjetos: number;
}

export interface AportesPorClienteFilters {
  projetosLabel?: string;
  statusLabel?: string;
  clientesLabel?: string;
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

function formatFileDate(): string {
  const now = new Date();
  const day   = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${now.getFullYear()}`;
}

function safeValue(val: unknown): number {
  const n = parseFloat(String(val ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function truncate(text: string, max: number): string {
  if (!text) return '-';
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
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

  const drawHeader = (reportTitle: string, reportSubtitle: string, sealLabel: string) => {
    const headerHeight = 38;
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
    doc.setFontSize(8);
    doc.text(reportSubtitle, marginX + 28, y + 25);

    doc.setFontSize(8.5);
    doc.text(`Emitido em ${issuedAtLabel}`, marginX + 28, y + 32);

    setFill(doc, COLORS.white);
    doc.roundedRect(pageWidth - marginX - 42, y + 25, 38, 8, 3, 3, 'F');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(sealLabel, pageWidth - marginX - 23, y + 30.2, { align: 'center' });

    y += headerHeight + 4;
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  const drawFiltersBand = (filters: { label: string; value: string }[]) => {
    const text = filters.map((f) => `${f.label}: ${f.value}`).join('   |   ');
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    const blockHeight = Math.max(12, 7 + lines.length * 4.4);

    ensureSpace(blockHeight + 4);

    setFill(doc, COLORS.navySoft);
    setDraw(doc, COLORS.border);
    doc.roundedRect(marginX, y, contentWidth, blockHeight, 3, 3, 'FD');

    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(lines, marginX + 5, y + 6.5);

    y += blockHeight + 6;
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
          ? { bg: COLORS.blueSoft, text: COLORS.blue,     border: COLORS.border }
          : tone === 'accent'
            ? { bg: COLORS.goldSoft, text: COLORS.gold,   border: COLORS.border }
            : tone === 'rose'
              ? { bg: COLORS.roseSoft, text: COLORS.rose, border: COLORS.border }
              : { bg: COLORS.white,  text: COLORS.graphite, border: COLORS.border };

    setFill(doc, palette.bg);
    setDraw(doc, palette.border);
    doc.roundedRect(x, cardY, width, height, 3, 3, 'FD');

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(label.toUpperCase(), x + 3, cardY + 6);

    setText(doc, palette.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const valueLines = doc.splitTextToSize(value, width - 6);
    doc.text(valueLines, x + 3, cardY + 13);
  };

  const drawResumoCards = (
    cards: { label: string; value: string; tone?: 'default' | 'positive' | 'highlight' | 'accent' | 'rose' }[],
  ) => {
    drawSectionTitle('Indicadores', 'Resumo dos Aportes');

    const gap        = 4;
    const cols       = cards.length;
    const cardWidth  = (contentWidth - gap * (cols - 1)) / cols;
    const cardHeight = 20;

    ensureSpace(cardHeight + 4);

    cards.forEach((card, index) => {
      const x = marginX + index * (cardWidth + gap);
      drawMetricCard(x, y, cardWidth, cardHeight, card.label, card.value, card.tone ?? 'default');
    });

    y += cardHeight + 8;
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
      doc.text('• Aportes por Cliente', marginX + 20, pageHeight - 8);
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
    topStart,
    bottomReserve,
    addPage,
    ensureSpace,
    drawSectionTitle,
    drawHeader,
    drawFiltersBand,
    drawMetricCard,
    drawResumoCards,
    drawTableHeader,
    drawFooters,
  };
}

// ─── Relatório: Aportes por Cliente ──────────────────────────────────────────

export function exportAportesPorClientePDF(
  clientes: AporteClienteItem[],
  resumo: AportesPorClienteResumo,
  filtros: AportesPorClienteFilters,
  { formatCurrency }: ExportContext,
) {
  if (!clientes.length) return;

  // ── Ordenação: clientes por realizado DESC; projetos de cada cliente por realizado DESC ──
  const clientes_ordenados = [...clientes]
    .map((cliente) => ({
      ...cliente,
      total_realizado: safeValue(cliente.total_realizado),
      total_previsto:  safeValue(cliente.total_previsto),
      projetos: [...(cliente.projetos || [])]
        .map((projeto) => ({
          ...projeto,
          realizado: safeValue(projeto.realizado),
          previsto:  safeValue(projeto.previsto),
        }))
        .sort((a, b) => b.realizado - a.realizado),
    }))
    .sort((a, b) => b.total_realizado - a.total_realizado);

  const total_realizado_geral = safeValue(resumo.totalRealizado);
  const total_previsto_geral  = safeValue(resumo.totalPrevisto);

  const issuedAtLabel = formatDateTimeNow();
  const doc    = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const engine = makePdfEngine(doc, issuedAtLabel);

  // ── Cabeçalho ──
  engine.drawHeader(
    'Aportes por Cliente',
    'Relatório de valores previstos e realizados por cliente, empresa ou grupo',
    'Aportes',
  );

  // ── Filtros aplicados ──
  engine.drawFiltersBand([
    { label: 'Projetos', value: filtros.projetosLabel || 'Todos' },
    { label: 'Status',   value: filtros.statusLabel   || 'Todos' },
    { label: 'Clientes', value: filtros.clientesLabel || 'Todos' },
  ]);

  // ── Cards de resumo ──
  engine.drawResumoCards([
    { label: 'Clientes',                   value: String(resumo.qtdClientes),           tone: 'default'   },
    { label: 'Total Aportado (Realizado)', value: formatCurrency(total_realizado_geral), tone: 'positive'  },
    { label: 'Total Previsto',             value: formatCurrency(total_previsto_geral),  tone: 'highlight' },
    { label: 'Projetos',                   value: String(resumo.qtdProjetos),           tone: 'default'   },
  ]);

  // ── Ranking geral ──
  engine.drawSectionTitle('Consolidado', 'Ranking Geral por Cliente');

  const rankingColumns = [
    { label: '#',              width:  9, align: 'center' as const },
    { label: 'Cliente',        width: 44, align: 'left'   as const },
    { label: 'Tipo',           width: 18, align: 'left'   as const },
    { label: 'Valor Realizado', width: 28, align: 'right' as const },
    { label: 'Valor Previsto', width: 28, align: 'right'  as const },
    { label: '% Realização',   width: 21, align: 'right'  as const },
    { label: '% do Total',     width: 18, align: 'right'  as const },
    { label: 'Qtd. Proj.',     width: 16, align: 'center' as const },
  ];

  const rankingColX: number[] = [];
  let rankingX = engine.marginX;
  rankingColumns.forEach((col) => { rankingColX.push(rankingX); rankingX += col.width; });

  engine.drawTableHeader(rankingColumns, rankingColX);

  clientes_ordenados.forEach((cliente, index) => {
    const rowH = 8;

    if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
      engine.addPage();
      engine.drawTableHeader(rankingColumns, rankingColX);
    }

    setFill(doc, index % 2 === 0 ? COLORS.light : COLORS.white);
    doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

    const ty = engine.y + 5.2;
    const percentualRealizacao = cliente.total_previsto > 0
      ? formatPercent((cliente.total_realizado / cliente.total_previsto) * 100)
      : '-';
    const percentualDoTotal = total_realizado_geral > 0
      ? formatPercent((cliente.total_realizado / total_realizado_geral) * 100)
      : '-';

    setText(doc, COLORS.graphite);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);

    doc.text(String(index + 1), rankingColX[0] + rankingColumns[0].width / 2, ty, { align: 'center' });
    doc.text(truncate(cliente.membro_nome, 26), rankingColX[1] + 2, ty);
    doc.text(cliente.membro_tipo, rankingColX[2] + 2, ty);

    setText(doc, COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.text(
      formatCurrency(cliente.total_realizado),
      rankingColX[3] + rankingColumns[3].width - 2,
      ty,
      { align: 'right' },
    );

    setText(doc, COLORS.graphite);
    doc.setFont('helvetica', 'normal');
    doc.text(
      formatCurrency(cliente.total_previsto),
      rankingColX[4] + rankingColumns[4].width - 2,
      ty,
      { align: 'right' },
    );
    doc.text(percentualRealizacao, rankingColX[5] + rankingColumns[5].width - 2, ty, { align: 'right' });
    doc.text(percentualDoTotal,    rankingColX[6] + rankingColumns[6].width - 2, ty, { align: 'right' });
    doc.text(
      String(cliente.projetos.length),
      rankingColX[7] + rankingColumns[7].width / 2,
      ty,
      { align: 'center' },
    );

    engine.y += rowH;
  });

  // ── Linha de totais ──
  const totalRowH = 9;
  if (engine.y + totalRowH > engine.pageHeight - engine.bottomReserve) engine.addPage();

  setFill(doc, COLORS.navySoft);
  setDraw(doc, COLORS.border);
  doc.setLineWidth(0.2);
  doc.rect(engine.marginX, engine.y, engine.contentWidth, totalRowH, 'FD');

  const totalTy = engine.y + 6;
  const percentualRealizacaoGeral = total_previsto_geral > 0
    ? formatPercent((total_realizado_geral / total_previsto_geral) * 100)
    : '-';
  const qtdProjetosTotal = clientes_ordenados.reduce((sum, cliente) => sum + cliente.projetos.length, 0);

  setText(doc, COLORS.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`TOTAL — ${resumo.qtdClientes} cliente(s)`, rankingColX[1] + 2, totalTy);
  doc.text(formatCurrency(total_realizado_geral), rankingColX[3] + rankingColumns[3].width - 2, totalTy, { align: 'right' });
  doc.text(formatCurrency(total_previsto_geral),  rankingColX[4] + rankingColumns[4].width - 2, totalTy, { align: 'right' });
  doc.text(percentualRealizacaoGeral, rankingColX[5] + rankingColumns[5].width - 2, totalTy, { align: 'right' });
  doc.text('100.0%', rankingColX[6] + rankingColumns[6].width - 2, totalTy, { align: 'right' });
  doc.text(String(qtdProjetosTotal), rankingColX[7] + rankingColumns[7].width / 2, totalTy, { align: 'center' });

  engine.y += totalRowH + 10;

  // ── Detalhamento por cliente ──
  engine.drawSectionTitle('Detalhamento', 'Projetos por Cliente');

  const projetoColumns = [
    { label: 'Projeto',         width: 86, align: 'left'  as const },
    { label: 'Status',          width: 30, align: 'left'  as const },
    { label: 'Valor Realizado', width: 33, align: 'right' as const },
    { label: 'Valor Previsto',  width: 33, align: 'right' as const },
  ];

  const projetoColX: number[] = [];
  let projetoX = engine.marginX;
  projetoColumns.forEach((col) => { projetoColX.push(projetoX); projetoX += col.width; });

  const maxBlockHeight = engine.pageHeight - engine.topStart - engine.bottomReserve;

  clientes_ordenados.forEach((cliente, index) => {
    const tituloH = 10;
    const resumoH = 10;
    const sectionHeight = tituloH + resumoH + 8 + cliente.projetos.length * 7 + 8;

    // Nunca cortar a barra de título: se a seção não couber, inicia nova página
    if (engine.y + Math.min(sectionHeight, maxBlockHeight) > engine.pageHeight - engine.bottomReserve) {
      engine.addPage();
    }

    // Barra de título do cliente
    setFill(doc, COLORS.navy);
    doc.roundedRect(engine.marginX, engine.y, engine.contentWidth, tituloH, 2, 2, 'F');

    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${index + 1}º — ${truncate(cliente.membro_nome, 38).toUpperCase()}`, engine.marginX + 4, engine.y + 6.5);

    const badgeLabel = cliente.membro_tipo;
    const badgeWidth = 20;
    const badgeX = engine.marginX + 4 + doc.getTextWidth(`${index + 1}º — ${truncate(cliente.membro_nome, 38).toUpperCase()}`) + 4;
    setFill(doc, COLORS.navySoft);
    doc.roundedRect(badgeX, engine.y + 2.5, badgeWidth, 5, 2, 2, 'F');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(badgeLabel, badgeX + badgeWidth / 2, engine.y + 6.1, { align: 'center' });

    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      formatCurrency(cliente.total_realizado),
      engine.pageWidth - engine.marginX - 4,
      engine.y + 6.8,
      { align: 'right' },
    );

    engine.y += tituloH;

    // Linha resumo do cliente
    const saldo = cliente.total_previsto - cliente.total_realizado;
    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.2);
    doc.rect(engine.marginX, engine.y, engine.contentWidth, resumoH, 'FD');

    const resumoTy = engine.y + 6.5;
    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text('Realizado:', engine.marginX + 4, resumoTy);
    setText(doc, COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(cliente.total_realizado), engine.marginX + 24, resumoTy);

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'normal');
    doc.text('Previsto:', engine.marginX + 74, resumoTy);
    setText(doc, COLORS.blue);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(cliente.total_previsto), engine.marginX + 92, resumoTy);

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'normal');
    doc.text('Saldo:', engine.marginX + 138, resumoTy);
    setText(doc, saldo > 0 ? COLORS.rose : COLORS.green);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(saldo), engine.pageWidth - engine.marginX - 4, resumoTy, { align: 'right' });

    engine.y += resumoH + 2;

    // Subtabela de projetos
    engine.drawTableHeader(projetoColumns, projetoColX);

    if (cliente.projetos.length === 0) {
      const rowH = 7;
      setFill(doc, COLORS.white);
      doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
      setText(doc, COLORS.slate);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.text('Nenhum projeto para os filtros aplicados.', engine.marginX + 2, engine.y + 4.8);
      engine.y += rowH;
    }

    cliente.projetos.forEach((projeto, projetoIndex) => {
      const rowH = 7;

      if (engine.y + rowH > engine.pageHeight - engine.bottomReserve) {
        engine.addPage();
        engine.drawTableHeader(projetoColumns, projetoColX);
      }

      setFill(doc, projetoIndex % 2 === 0 ? COLORS.light : COLORS.white);
      doc.rect(engine.marginX, engine.y, engine.contentWidth, rowH, 'F');
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(engine.marginX, engine.y + rowH, engine.pageWidth - engine.marginX, engine.y + rowH);

      const ty = engine.y + 4.8;
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.text(truncate(projeto.nome, 52), projetoColX[0] + 2, ty);
      doc.text(truncate(projeto.status || '-', 18), projetoColX[1] + 2, ty);

      setText(doc, COLORS.green);
      doc.setFont('helvetica', 'bold');
      doc.text(
        formatCurrency(projeto.realizado),
        projetoColX[2] + projetoColumns[2].width - 2,
        ty,
        { align: 'right' },
      );

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.text(
        formatCurrency(projeto.previsto),
        projetoColX[3] + projetoColumns[3].width - 2,
        ty,
        { align: 'right' },
      );

      engine.y += rowH;
    });

    engine.y += 8;
  });

  engine.drawFooters();

  doc.save(`aportes-por-cliente-${formatFileDate()}.pdf`);
}
