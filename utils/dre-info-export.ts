import jsPDF from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DreInfoExportItem {
  id: number;
  tipo: string;
  nome: string;
  ordem: number;
  nivel: number;
  valor: number;
  subgrupo_funcao?: string;
}

export interface DreInfoExportParams {
  dataInicio: string;
  dataFim: string;
  tipoData: 'competencia' | 'pagamento';
  estruturaNome: string;
  matrizNome: string;
  projetoNome?: string;
}

// ─── Palette (identical to rentabilidade) ────────────────────────────────────

type RgbColor = [number, number, number];

const COLORS = {
  navy:      [17,  31,  59] as RgbColor,
  navySoft:  [229, 236, 246] as RgbColor,
  graphite:  [59,  68,  82] as RgbColor,
  slate:     [107, 114, 128] as RgbColor,
  border:    [217, 223, 232] as RgbColor,
  light:     [245, 247, 250] as RgbColor,
  white:     [255, 255, 255] as RgbColor,
  green:     [22,  101, 52] as RgbColor,
  greenSoft: [236, 253, 245] as RgbColor,
  gold:      [146, 103, 33] as RgbColor,
  goldSoft:  [255, 251, 235] as RgbColor,
  blue:      [29,  78,  216] as RgbColor,
  blueSoft:  [239, 246, 255] as RgbColor,
  rose:      [190, 24,  93] as RgbColor,
  roseSoft:  [255, 241, 242] as RgbColor,
} as const;

// ─── Low-level helpers ────────────────────────────────────────────────────────

function setFill(doc: jsPDF, c: RgbColor) { doc.setFillColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: RgbColor) { doc.setDrawColor(c[0], c[1], c[2]); }
function setText(doc: jsPDF, c: RgbColor) { doc.setTextColor(c[0], c[1], c[2]); }

function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function formatDateStr(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateTimeNow(): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(now);
  return `${date} às ${time}`;
}

function sanitize(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ─── Logo (same 8-point star as rentabilidade) ───────────────────────────────

function drawProvisionLogo(doc: jsPDF, x: number, y: number, size: number, color: RgbColor) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const inner = size * 0.08;
  const outer = size * 0.31;
  const dotR = size * 0.065;

  setDraw(doc, color);
  setFill(doc, color);
  doc.setLineWidth(0.8);

  const pts = [
    { dx: 0, dy: -outer },
    { dx: outer * 0.72, dy: -outer * 0.72 },
    { dx: outer, dy: 0 },
    { dx: outer * 0.72, dy: outer * 0.72 },
    { dx: 0, dy: outer },
    { dx: -outer * 0.72, dy: outer * 0.72 },
    { dx: -outer, dy: 0 },
    { dx: -outer * 0.72, dy: -outer * 0.72 },
  ];

  pts.forEach(p => {
    doc.line(cx, cy, cx + p.dx, cy + p.dy);
    doc.circle(cx + p.dx, cy + p.dy, dotR, 'FD');
  });
  doc.circle(cx, cy, inner, 'FD');
}

// ─── Executive summary sentences ─────────────────────────────────────────────

function buildDreExecutiveSummary(
  dreData: DreInfoExportItem[],
  aportes: any[],
  retiradas: any[],
  emprestimos: any[],
  params: DreInfoExportParams,
  formatCurrency: (v: number) => string,
): string[] {
  const somaItems = dreData
    .filter(i => i.tipo === 'SOMA')
    .sort((a, b) => a.ordem - b.ordem);

  const totalAportes   = aportes.reduce((s, a) => s + safeNum(a.valor), 0);
  const totalRetiradas = retiradas.reduce((s, r) => s + safeNum(r.valor), 0);

  // EMPRESTIMO = saída de caixa · PAGAMENTO = entrada de caixa
  const totalEmprestimosSaida   = emprestimos.filter(e => e.tipo === 'EMPRESTIMO').reduce((s, e) => s + safeNum(e.valor), 0);
  const totalEmprestimosEntrada = emprestimos.filter(e => e.tipo === 'PAGAMENTO').reduce((s, e) => s + safeNum(e.valor), 0);

  const criterio  = params.tipoData === 'competencia'
    ? 'competência'
    : 'caixa (pagamento / recebimento)';

  const periodo = `${formatDateStr(params.dataInicio)} a ${formatDateStr(params.dataFim)}`;

  const sentences: string[] = [
    `O demonstrativo cobre o período de ${periodo}, apurado pelo critério de ${criterio}, utilizando a estrutura "${params.estruturaNome}"${params.projetoNome ? `, filtrado pelo projeto "${params.projetoNome}"` : ''}.`,
  ];

  somaItems.slice(0, 3).forEach(soma => {
    const v = safeNum(soma.valor);
    const signal = v >= 0 ? 'positivo' : 'negativo';
    sentences.push(`${soma.nome}: ${formatCurrency(v)} — saldo ${signal} no período.`);
  });

  if (totalAportes > 0 || totalRetiradas > 0) {
    sentences.push(
      `Os aportes de sócios totalizaram ${formatCurrency(totalAportes)} e as retiradas somaram ${formatCurrency(totalRetiradas)} no período analisado.`,
    );
  }

  if (totalEmprestimosSaida > 0 || totalEmprestimosEntrada > 0) {
    sentences.push(
      `Os empréstimos concedidos somaram ${formatCurrency(totalEmprestimosSaida)} (saída de caixa) e os pagamentos de empréstimo somaram ${formatCurrency(totalEmprestimosEntrada)} (entrada de caixa).`,
    );
  }

  if (somaItems.length > 3) {
    const last = somaItems[somaItems.length - 1];
    sentences.push(
      `O saldo final consolidado — ${last.nome} — foi de ${formatCurrency(safeNum(last.valor))} no período.`,
    );
  }

  return sentences.slice(0, 7);
}

// ─── Main export function ─────────────────────────────────────────────────────

export function exportDreInfoToPDF(
  dreData: DreInfoExportItem[],
  aportes: any[],
  retiradas: any[],
  emprestimos: any[],
  params: DreInfoExportParams,
  formatCurrency: (v: number) => string,
): void {
  // EMPRESTIMO = saída de caixa · PAGAMENTO = entrada de caixa
  const emprestimosSaida   = (emprestimos || []).filter((e: any) => e.tipo === 'EMPRESTIMO');
  const emprestimosEntrada = (emprestimos || []).filter((e: any) => e.tipo === 'PAGAMENTO');

  const doc          = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth    = doc.internal.pageSize.width;
  const pageHeight   = doc.internal.pageSize.height;
  const marginX      = 14;
  const contentWidth = pageWidth - marginX * 2;
  const topStart     = 14;
  const bottomRes    = 18;
  const issuedAt     = formatDateTimeNow();

  let y = topStart;

  // ── Page helpers ────────────────────────────────────────────────────────────

  const addPage = () => { doc.addPage(); y = topStart; };

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - bottomRes) addPage();
  };

  // ── Section title (identical pattern to rentabilidade) ──────────────────────

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

  // ── 1. Cabeçalho executivo ───────────────────────────────────────────────────

  const drawHeader = () => {
    const hh = 38;
    setFill(doc, COLORS.navy);
    doc.roundedRect(marginX, y, contentWidth, hh, 4, 4, 'F');

    drawProvisionLogo(doc, marginX + 5, y + 8, 18, COLORS.white);

    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROVISION', marginX + 28, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Relatório Gerencial', pageWidth - marginX - 4, y + 9, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('DRE Info – Demonstrativo Analítico', marginX + 28, y + 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(params.estruturaNome, marginX + 28, y + 29);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emitido em ${issuedAt}`, marginX + 28, y + 34);

    // Badge "Análise DRE"
    setFill(doc, COLORS.white);
    doc.roundedRect(pageWidth - marginX - 38, y + 24, 34, 8, 3, 3, 'F');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Análise DRE', pageWidth - marginX - 21, y + 29.2, { align: 'center' });

    y += hh + 4;
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  // ── 2. Bloco de identificação ───────────────────────────────────────────────

  const drawInfoBlock = () => {
    drawSectionTitle('Identificação', 'Dados do Relatório');

    const criterioLabel = params.tipoData === 'competencia'
      ? 'Data de Competência'
      : 'Data de Pagamento / Recebimento';

    const labels = [
      { label: 'Data Início',     value: formatDateStr(params.dataInicio) },
      { label: 'Data Fim',        value: formatDateStr(params.dataFim) },
      { label: 'Critério',        value: criterioLabel },
      { label: 'Matriz',          value: params.matrizNome },
      { label: 'Estrutura DRE',   value: params.estruturaNome },
      { label: 'Projeto',         value: params.projetoNome || 'Todos' },
      { label: 'Linhas no DRE',   value: String(dreData.length) },
      { label: 'Emitido em',      value: issuedAt },
    ];

    const gap      = 5;
    const colWidth = (contentWidth - gap) / 2;

    const rowHeights = [];
    for (let i = 0; i < labels.length; i += 2) {
      const pair = labels.slice(i, i + 2);
      const rh = pair.reduce((h, item) => {
        const lines = doc.splitTextToSize(item.value, colWidth - 8);
        return Math.max(h, 10 + lines.length * 4.2);
      }, 16);
      rowHeights.push(rh);
    }

    ensureSpace(rowHeights.reduce((s, h) => s + h + 4, 0));

    let ly = y;
    labels.forEach((item, index) => {
      const ri  = Math.floor(index / 2);
      const ci  = index % 2;
      const bx  = marginX + ci * (colWidth + gap);
      const bh  = rowHeights[ri];

      setFill(doc, COLORS.light);
      setDraw(doc, COLORS.border);
      doc.roundedRect(bx, ly, colWidth, bh, 3, 3, 'FD');

      setText(doc, COLORS.slate);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(item.label.toUpperCase(), bx + 4, ly + 5);

      setText(doc, COLORS.navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const vLines = doc.splitTextToSize(item.value, colWidth - 8);
      doc.text(vLines, bx + 4, ly + 10.5);

      if (ci === 1) ly += bh + 4;
    });

    y = ly + 2;
  };

  // ── 3. Painel executivo / indicadores ──────────────────────────────────────

  const drawMetricCard = (
    x: number, cy: number, w: number, h: number,
    label: string, value: string,
    tone: 'default' | 'positive' | 'highlight' | 'accent' = 'default',
  ) => {
    const pal = tone === 'positive'  ? { bg: COLORS.greenSoft, text: COLORS.green, border: COLORS.border }
              : tone === 'highlight' ? { bg: COLORS.navySoft,  text: COLORS.navy,  border: COLORS.navy }
              : tone === 'accent'    ? { bg: COLORS.goldSoft,  text: COLORS.gold,  border: COLORS.border }
              :                        { bg: COLORS.white,     text: COLORS.graphite, border: COLORS.border };

    setFill(doc, pal.bg);
    setDraw(doc, pal.border);
    doc.roundedRect(x, cy, w, h, 3, 3, 'FD');

    if (tone === 'highlight') {
      setFill(doc, COLORS.navy);
      doc.roundedRect(x, cy, w, 3, 3, 3, 'F');
    }

    setText(doc, COLORS.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 4, cy + 7);

    setText(doc, pal.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    const vLines = doc.splitTextToSize(value, w - 8);
    doc.text(vLines, x + 4, cy + 14);
  };

  const drawIndicatorCards = () => {
    drawSectionTitle('Indicadores', 'Painel Executivo');

    const somaItems = dreData
      .filter(i => i.tipo === 'SOMA')
      .sort((a, b) => a.ordem - b.ordem);

    const totalAportes   = aportes.reduce((s, a) => s + safeNum(a.valor), 0);
    const totalRetiradas = retiradas.reduce((s, r) => s + safeNum(r.valor), 0);

    const cards: { label: string; value: string; tone: 'default' | 'positive' | 'highlight' | 'accent' }[] = [];

    // Add SOMA cards (up to 6)
    somaItems.slice(0, 6).forEach((soma, idx) => {
      const v = safeNum(soma.valor);
      const isLast = idx === somaItems.length - 1;
      const tone: 'default' | 'positive' | 'highlight' | 'accent' =
        isLast ? 'highlight' : v >= 0 ? 'positive' : 'default';
      cards.push({ label: soma.nome, value: formatCurrency(v), tone });
    });

    // Aportes & Retiradas
    cards.push({ label: 'Total de Aportes',   value: formatCurrency(totalAportes),   tone: 'positive' });
    cards.push({ label: 'Total de Retiradas', value: formatCurrency(totalRetiradas), tone: 'default'  });

    // Empréstimos (entrada = pagamentos · saída = empréstimos concedidos)
    const totalEmprestimosEntrada = emprestimosEntrada.reduce((sum: number, e: any) => sum + safeNum(e.valor), 0);
    const totalEmprestimosSaida   = emprestimosSaida.reduce((sum: number, e: any) => sum + safeNum(e.valor), 0);
    if (totalEmprestimosEntrada > 0 || totalEmprestimosSaida > 0) {
      cards.push({ label: 'Empréstimo Entrada', value: formatCurrency(totalEmprestimosEntrada), tone: 'positive' });
      cards.push({ label: 'Empréstimo Saída',   value: formatCurrency(totalEmprestimosSaida),   tone: 'default'  });
    }

    // Limit to 8 cards
    const visibleCards = cards.slice(0, 8);

    const gap       = 4;
    const cols      = 2;
    const cardW     = (contentWidth - gap) / cols;
    const cardH     = 21;
    let localY      = y;

    visibleCards.forEach((card, idx) => {
      if (idx % cols === 0) ensureSpace(cardH + 4);
      const x = marginX + (idx % cols) * (cardW + gap);
      drawMetricCard(x, localY, cardW, cardH, card.label, card.value, card.tone);
      if (idx % cols === cols - 1) localY += cardH + gap;
    });

    if (visibleCards.length % cols !== 0) localY += cardH + gap;
    y = localY + 2;
  };

  // ── 4. Leitura executiva ────────────────────────────────────────────────────

  const drawExecutiveSummary = () => {
    drawSectionTitle('Leitura executiva', 'Resumo Executivo');

    const sentences = buildDreExecutiveSummary(dreData, aportes, retiradas, emprestimos || [], params, formatCurrency);

    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);

    const lineHeights = sentences.map(s =>
      doc.splitTextToSize(`• ${s}`, contentWidth - 10).length * 5.1,
    );
    const blockH = lineHeights.reduce((s, h) => s + h, 10);
    ensureSpace(blockH + 4);
    doc.roundedRect(marginX, y, contentWidth, blockH, 3, 3, 'FD');

    let ty = y + 7;
    sentences.forEach(s => {
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.2);
      const lines = doc.splitTextToSize(`• ${s}`, contentWidth - 10);
      doc.text(lines, marginX + 5, ty);
      ty += lines.length * 5.1;
    });

    y += blockH + 6;
  };

  // ── 5. Demonstrativo analítico (tabela principal) ───────────────────────────

  const drawDreTable = () => {
    drawSectionTitle('Demonstrativo', 'DRE Info – Demonstrativo Analítico');

    // Column definitions: Ordem | Tipo | Descrição | Valor
    const COL_ORDEM = 12;
    const COL_TIPO  = 24;
    const COL_VALOR = 30;
    const COL_NOME  = contentWidth - COL_ORDEM - COL_TIPO - COL_VALOR;

    const colX = [
      marginX,                             // Ordem
      marginX + COL_ORDEM,                 // Tipo
      marginX + COL_ORDEM + COL_TIPO,      // Descrição
      marginX + COL_ORDEM + COL_TIPO + COL_NOME, // Valor
    ];

    const drawTableHeader = () => {
      ensureSpace(10);
      setFill(doc, COLORS.navy);
      doc.rect(marginX, y, contentWidth, 8, 'F');
      setText(doc, COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Ord.',         colX[0] + 2,             y + 5);
      doc.text('Tipo',         colX[1] + 2,             y + 5);
      doc.text('Descrição',    colX[2] + 2,             y + 5);
      doc.text('Valor',        colX[3] + COL_VALOR - 2, y + 5, { align: 'right' });
      y += 8;
    };

    // Badge for DRE type
    const drawTypeBadge = (tipo: string, bx: number, by: number) => {
      const pal =
        tipo === 'GRUPO'    ? { bg: COLORS.navySoft, text: COLORS.navy } :
        tipo === 'SUBGRUPO' ? { bg: COLORS.blueSoft, text: COLORS.blue } :
        tipo === 'SOMA'     ? { bg: COLORS.goldSoft, text: COLORS.gold } :
        tipo === 'APORTE'   ? { bg: COLORS.greenSoft, text: COLORS.green } :
        tipo === 'RETIRADA' ? { bg: COLORS.roseSoft, text: COLORS.rose } :
        tipo === 'EMPRESTIMO_ENTRADA' ? { bg: COLORS.greenSoft, text: COLORS.green } :
        tipo === 'EMPRESTIMO_SAIDA'   ? { bg: COLORS.roseSoft,  text: COLORS.rose } :
                              { bg: COLORS.light,     text: COLORS.graphite };

      setFill(doc, pal.bg);
      doc.roundedRect(bx, by, 22, 5, 2, 2, 'F');
      setText(doc, pal.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      const badgeLabel =
        tipo === 'EMPRESTIMO_ENTRADA' ? 'EMP. ENTRADA' :
        tipo === 'EMPRESTIMO_SAIDA'   ? 'EMP. SAÍDA'   :
        tipo;
      doc.text(badgeLabel, bx + 11, by + 3.5, { align: 'center' });
    };

    drawTableHeader();

    let rowIndex = 0;

    dreData.forEach(item => {
      const isBold       = item.tipo === 'GRUPO' || item.tipo === 'SOMA';
      const indent       = (item.nivel - 1) * 4;
      const availNome    = COL_NOME - 4 - indent;
      const nomeLines    = doc.splitTextToSize(item.nome, availNome);
      const rowH         = Math.max(item.tipo === 'SOMA' ? 9.5 : 8.5, nomeLines.length * 4.2 + 3.5);

      // ── Page break ──────────────────────────────────────────────────────────
      if (y + rowH > pageHeight - bottomRes) {
        addPage();
        drawTableHeader();
        rowIndex = 0;
      }

      // ── Separator line ABOVE SOMA ────────────────────────────────────────────
      if (item.tipo === 'SOMA') {
        setDraw(doc, COLORS.gold);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, pageWidth - marginX, y);
      }

      // ── Row background ───────────────────────────────────────────────────────
      const rowBg =
        item.tipo === 'GRUPO'    ? COLORS.navySoft :
        item.tipo === 'SOMA'     ? COLORS.goldSoft :
        item.tipo === 'APORTE'   ? COLORS.greenSoft :
        item.tipo === 'RETIRADA' ? COLORS.roseSoft :
        item.tipo === 'EMPRESTIMO_ENTRADA' ? COLORS.greenSoft :
        item.tipo === 'EMPRESTIMO_SAIDA'   ? COLORS.roseSoft :
        rowIndex % 2 === 0       ? COLORS.light : COLORS.white;

      setFill(doc, rowBg);
      doc.rect(marginX, y, contentWidth, rowH, 'F');

      // Bottom border
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(marginX, y + rowH, pageWidth - marginX, y + rowH);

      const textY = y + 5.5;

      // ── Ordem ────────────────────────────────────────────────────────────────
      setText(doc, isBold ? COLORS.navy : COLORS.slate);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.text(String(item.ordem), colX[0] + 2, textY);

      // ── Tipo badge ───────────────────────────────────────────────────────────
      drawTypeBadge(item.tipo, colX[1] + 1, y + (rowH - 5) / 2);

      // ── Nome (com recuo por nível) ───────────────────────────────────────────
      setText(doc, isBold ? COLORS.navy : COLORS.graphite);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(isBold ? 9 : 8.5);
      doc.text(nomeLines, colX[2] + 2 + indent, textY);

      // ── Valor ────────────────────────────────────────────────────────────────
      const valorNum = safeNum(item.valor);
      const valorFmt = formatCurrency(valorNum);
      const valorColor =
        item.tipo === 'RETIRADA' || item.tipo === 'EMPRESTIMO_SAIDA' || valorNum < 0 ? COLORS.rose :
        valorNum > 0                              ? COLORS.green :
                                                    COLORS.graphite;
      setText(doc, valorColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isBold ? 9 : 8.5);
      doc.text(valorFmt, colX[3] + COL_VALOR - 2, textY, { align: 'right' });

      y += rowH;

      // ── Separator line BELOW SOMA ────────────────────────────────────────────
      if (item.tipo === 'SOMA') {
        setDraw(doc, COLORS.gold);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 1;
      }

      rowIndex++;

      // ── Sub-rows: APORTE participantes ───────────────────────────────────────
      if (item.tipo === 'APORTE' && aportes.length > 0) {
        const socioMap = new Map<string, number>();
        aportes.forEach((a: any) => {
          const nome = a.socio_nome || 'N/A';
          socioMap.set(nome, (socioMap.get(nome) || 0) + safeNum(a.valor));
        });

        socioMap.forEach((val, nomeSocio) => {
          if (y + 7 > pageHeight - bottomRes) { addPage(); drawTableHeader(); }

          setFill(doc, COLORS.light);
          doc.rect(marginX, y, contentWidth, 7, 'F');
          setDraw(doc, COLORS.border);
          doc.setLineWidth(0.15);
          doc.line(marginX, y + 7, pageWidth - marginX, y + 7);

          setFill(doc, COLORS.green);
          doc.circle(colX[2] + 8, y + 3.5, 1, 'F');

          setText(doc, COLORS.graphite);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.8);
          doc.text(nomeSocio, colX[2] + 11, y + 5);

          setText(doc, COLORS.green);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.8);
          doc.text(formatCurrency(safeNum(val)), colX[3] + COL_VALOR - 2, y + 5, { align: 'right' });

          y += 7;
        });

        y += 2;
      }

      // ── Sub-rows: RETIRADA participantes ─────────────────────────────────────
      if (item.tipo === 'RETIRADA' && retiradas.length > 0) {
        const socioMap = new Map<string, number>();
        retiradas.forEach((r: any) => {
          const nome = r.socio_nome || 'N/A';
          socioMap.set(nome, (socioMap.get(nome) || 0) + safeNum(r.valor));
        });

        socioMap.forEach((val, nomeSocio) => {
          if (y + 7 > pageHeight - bottomRes) { addPage(); drawTableHeader(); }

          setFill(doc, COLORS.light);
          doc.rect(marginX, y, contentWidth, 7, 'F');
          setDraw(doc, COLORS.border);
          doc.setLineWidth(0.15);
          doc.line(marginX, y + 7, pageWidth - marginX, y + 7);

          setFill(doc, COLORS.rose);
          doc.circle(colX[2] + 8, y + 3.5, 1, 'F');

          setText(doc, COLORS.graphite);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.8);
          doc.text(nomeSocio, colX[2] + 11, y + 5);

          setText(doc, COLORS.rose);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.8);
          doc.text(formatCurrency(safeNum(val)), colX[3] + COL_VALOR - 2, y + 5, { align: 'right' });

          y += 7;
        });

        y += 2;
      }

      // ── Sub-rows: EMPRÉSTIMO ENTRADA / SAÍDA participantes ───────────────────
      const emprestimosDoItem =
        item.tipo === 'EMPRESTIMO_ENTRADA' ? emprestimosEntrada :
        item.tipo === 'EMPRESTIMO_SAIDA'   ? emprestimosSaida   :
        [];

      if (emprestimosDoItem.length > 0) {
        const cor = item.tipo === 'EMPRESTIMO_ENTRADA' ? COLORS.green : COLORS.rose;

        const socioMap = new Map<string, number>();
        emprestimosDoItem.forEach((e: any) => {
          const nome = e.socio_nome || 'N/A';
          socioMap.set(nome, (socioMap.get(nome) || 0) + safeNum(e.valor));
        });

        socioMap.forEach((val, nomeSocio) => {
          if (y + 7 > pageHeight - bottomRes) { addPage(); drawTableHeader(); }

          setFill(doc, COLORS.light);
          doc.rect(marginX, y, contentWidth, 7, 'F');
          setDraw(doc, COLORS.border);
          doc.setLineWidth(0.15);
          doc.line(marginX, y + 7, pageWidth - marginX, y + 7);

          setFill(doc, cor);
          doc.circle(colX[2] + 8, y + 3.5, 1, 'F');

          setText(doc, COLORS.graphite);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.8);
          doc.text(nomeSocio, colX[2] + 11, y + 5);

          setText(doc, cor);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.8);
          doc.text(formatCurrency(safeNum(val)), colX[3] + COL_VALOR - 2, y + 5, { align: 'right' });

          y += 7;
        });

        y += 2;
      }
    });

    y += 6;
  };

  // ── 6. Seção de critérios / observações ────────────────────────────────────

  const drawCriterios = () => {
    drawSectionTitle('Critérios', 'Observações do Relatório');

    const criterioLabel = params.tipoData === 'competencia'
      ? 'competência (data de emissão/vencimento)'
      : 'caixa (data efetiva de pagamento ou recebimento)';

    const items = [
      `Os valores seguem o critério de ${criterioLabel}.`,
      'A ordem e hierarquia das linhas respeitam integralmente a configuração de Estrutura DRE cadastrada no sistema.',
      'Grupos exibem a soma dos subgrupos vinculados. Linhas de SOMA agregam os itens imediatamente anteriores conforme a configuração.',
      'Aportes, retiradas e empréstimos correspondem exclusivamente aos registros vinculados à matriz e ao período selecionado.',
      'Empréstimos concedidos reduzem o resultado (saída de caixa) e pagamentos de empréstimo o aumentam (entrada de caixa).',
      'Campos sem valor apurado no período são apresentados como R$ 0,00.',
      `Data e hora de emissão: ${issuedAt}.`,
    ];

    const gap      = 4;
    const colWidth = (contentWidth - gap) / 2;

    const heights = items.map(item => {
      const lines = doc.splitTextToSize(item, colWidth - 10);
      return Math.max(16, 9 + lines.length * 4.4);
    });

    let ly = y;
    items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        ensureSpace(Math.max(heights[idx], heights[idx + 1] ?? 0) + 4);
        if (idx > 0) ly += Math.max(heights[idx - 2], heights[idx - 1] ?? 0) + gap;
      }

      const bx = marginX + (idx % 2) * (colWidth + gap);
      const bh = heights[idx];

      setFill(doc, COLORS.light);
      setDraw(doc, COLORS.border);
      doc.roundedRect(bx, ly, colWidth, bh, 3, 3, 'FD');

      setFill(doc, COLORS.navy);
      doc.circle(bx + 5, ly + 6, 1.4, 'F');

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(item, colWidth - 10);
      doc.text(lines, bx + 9, ly + 7);
    });

    // Advance y past last row
    const lastPairStart = Math.floor((items.length - 1) / 2) * 2;
    y = ly + Math.max(heights[lastPairStart] || 0, heights[lastPairStart + 1] || 0) + gap + 4;
  };

  // ── Execute all sections ────────────────────────────────────────────────────

  drawHeader();
  drawInfoBlock();
  drawIndicatorCards();
  drawExecutiveSummary();
  drawDreTable();
  drawCriterios();

  // ── 7. Rodapé institucional (todas as páginas) ──────────────────────────────

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);

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
    doc.text(`Emitido em ${issuedAt}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Página ${p} de ${pages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const matrizSafe  = sanitize(params.matrizNome  || 'matriz');
  const dateStrSafe = params.dataInicio.replace(/-/g, '') + '_' + params.dataFim.replace(/-/g, '');
  doc.save(`DRE_Info_${matrizSafe}_${dateStrSafe}.pdf`);
}
