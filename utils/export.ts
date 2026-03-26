import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface ExportData {
  data_vencimento: string;
  data_pagamento?: string;
  data_recebimento?: string;
  fornecedor_nome?: string;
  cliente_nome?: string;
  projeto_nome: string;
  valor: number;
  conta_nome: string;
  parcela: number;
  total_parcelas: number;
  situacao_pagamento: string;
  numero_documento?: string;
}

export function exportToExcel(
  data: ExportData[], 
  filename: string, 
  type: 'despesas' | 'receitas',
  formatCurrency: (value: number) => string
) {
  // Prepare data for Excel
  const excelData = data.map(item => {
    const baseData = {
      'Data Vencimento': item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '',
      'Projeto': item.projeto_nome || '',
      'Valor': item.valor || 0,
      'Conta Corrente': item.conta_nome || '',
      'Parcela': `${item.parcela}/${item.total_parcelas}`,
      'Situação': item.situacao_pagamento || '',
    };

    if (type === 'despesas') {
      return {
        ...baseData,
        'Data Pagamento': item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : '',
        'Fornecedor': item.fornecedor_nome || '',
      };
    } else {
      return {
        'Cliente': item.cliente_nome || '',
        ...baseData,
        'Data Recebimento': item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString('pt-BR') : '',
      };
    }
  });

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);
  
  // Auto-size columns
  const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 15 }));
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type === 'despesas' ? 'Despesas' : 'Receitas');

  // Download file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportExtratoClienteExcel(
  data: any[],
  filename: string,
  clienteNome: string,
  formatCurrency: (value: number) => string
) {
  const excelData = data.map(item => ({
    'Data Pagamento': item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : '',
    'Cliente': item.cliente_nome || clienteNome || '',
    'Nº Documento': item.numero_documento || '',
    'Projeto': item.projeto_nome || '',
    'Valor': Number(item.valor) || 0,
    'Conta Corrente': item.conta_corrente || '',
    'Observações': item.observacoes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  despesasData: ExportData[],
  receitasData: ExportData[],
  filename: string,
  formatCurrency: (value: number) => string,
  filtros?: any,
  projetoInfo?: any,
  orcamentoData?: any[],
  aportesData?: any[]
) {
  type RgbColor = [number, number, number];
  const C = {
    navy:      [17, 31, 59]    as RgbColor,
    navySoft:  [229, 236, 246] as RgbColor,
    graphite:  [59, 68, 82]    as RgbColor,
    slate:     [107, 114, 128] as RgbColor,
    border:    [217, 223, 232] as RgbColor,
    light:     [245, 247, 250] as RgbColor,
    white:     [255, 255, 255] as RgbColor,
    green:     [22, 101, 52]   as RgbColor,
    greenSoft: [236, 253, 245] as RgbColor,
    rose:      [190, 24, 93]   as RgbColor,
    roseSoft:  [255, 241, 242] as RgbColor,
    blue:      [29, 78, 216]   as RgbColor,
    blueSoft:  [239, 246, 255] as RgbColor,
    gold:      [146, 103, 33]  as RgbColor,
    goldSoft:  [255, 251, 235] as RgbColor,
  };

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.width;
  
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const bottomReserve = 18;
  const topStart = 14;
  const emittedAt = new Date();
  const issuedAtLabel =
    emittedAt.toLocaleDateString('pt-BR') +
    ' às ' +
    emittedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  let y = topStart;

  const sf = (color: RgbColor) => doc.setFillColor(color[0], color[1], color[2]);
  const sd = (color: RgbColor) => doc.setDrawColor(color[0], color[1], color[2]);
  const st = (color: RgbColor) => doc.setTextColor(color[0], color[1], color[2]);

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '-';
    const p = new Date(d);
    return isNaN(p.getTime()) ? '-' : p.toLocaleDateString('pt-BR');
  };

  const addPage = () => { doc.addPage(); y = topStart; };
  const ensureSpace = (h: number) => { if (y + h > pageHeight - bottomReserve) addPage(); };

  const totalDespesas = despesasData.reduce((s, i) => s + Math.abs(Number(i.valor) || 0), 0);
  const totalReceitas = receitasData.reduce((s, i) => s + Math.abs(Number(i.valor) || 0), 0);
  const saldoLiquido = totalReceitas - totalDespesas;
  const totalRegistros = despesasData.length + receitasData.length;

  const drawLogo = (lx: number, ly: number, size: number, color: RgbColor) => {
    const cx = lx + size / 2, cy = ly + size / 2;
    const inner = size * 0.08, outer = size * 0.31, outerR = size * 0.065;
    sd(color); sf(color); doc.setLineWidth(0.8);
    const pts = [
      { dx: 0, dy: -outer }, { dx: outer * 0.72, dy: -outer * 0.72 },
      { dx: outer, dy: 0 }, { dx: outer * 0.72, dy: outer * 0.72 },
      { dx: 0, dy: outer }, { dx: -outer * 0.72, dy: outer * 0.72 },
      { dx: -outer, dy: 0 }, { dx: -outer * 0.72, dy: -outer * 0.72 },
    ];
    pts.forEach(p => { doc.line(cx, cy, cx + p.dx, cy + p.dy); doc.circle(cx + p.dx, cy + p.dy, outerR, 'FD'); });
    doc.circle(cx, cy, inner, 'FD');
  };

  const drawSectionTitle = (eyebrow: string, title: string, show: 'both' | 'eyebrow' | 'title' = 'both') => {
    ensureSpace(16);
    if (show !== 'title' && eyebrow) {
      st(C.slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(eyebrow.toUpperCase(), marginX, y);
      y += 4;
    }
    if (show !== 'eyebrow' && title) {
      st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text(title, marginX, y);
      y += 4.5;
    }
    sd(C.border); doc.setLineWidth(0.35);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  };

  const drawHeader = () => {
    const h = 34;
    sf(C.navy); doc.roundedRect(marginX, y, contentWidth, h, 4, 4, 'F');
    drawLogo(marginX + 5, y + 5, 18, C.white);
    st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('PROVISION', marginX + 28, y + 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Relatório Financeiro', pageWidth - marginX - 4, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Relatório por Projeto — Extrato', marginX + 28, y + 18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
    doc.text(projetoInfo?.name || 'Todos os Projetos', marginX + 28, y + 25);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`Emitido em ${issuedAtLabel}`, marginX + 28, y + 30);
    sf(C.white); doc.roundedRect(pageWidth - marginX - 42, y + 21, 38, 8, 3, 3, 'F');
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Extrato Financeiro', pageWidth - marginX - 23, y + 26.2, { align: 'center' });
    y += h + 4;
    sd(C.border); doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  const drawInfoBlock = () => {
    drawSectionTitle('Identificação', '', 'eyebrow');
    const labels: { label: string; value: string }[] = [];
    if (projetoInfo?.name) labels.push({ label: 'Projeto', value: projetoInfo.name });
    if (filtros?.situacaoPagamento) labels.push({ label: 'Situação', value: filtros.situacaoPagamento });
    if (filtros?.dataVencimentoInicio || filtros?.dataVencimentoFim) {
      labels.push({ label: 'Período Vencimento', value: `${filtros.dataVencimentoInicio || '—'} até ${filtros.dataVencimentoFim || '—'}` });
    }
    if (filtros?.dataPagamentoInicio || filtros?.dataPagamentoFim) {
      labels.push({ label: 'Período Pagamento/Recebimento', value: `${filtros.dataPagamentoInicio || '—'} até ${filtros.dataPagamentoFim || '—'}` });
    }
    labels.push({ label: 'Emitido em', value: issuedAtLabel });
    if (labels.length % 2 !== 0) labels.push({ label: 'Registros', value: `${totalRegistros} registro(s)` });

    const gap = 5;
    const colWidth = (contentWidth - gap) / 2;
    const rowHeights: number[] = [];
    for (let i = 0; i < labels.length; i += 2) {
      const pair = labels.slice(i, i + 2);
      rowHeights.push(pair.reduce((rh, item) => Math.max(rh, 10 + doc.splitTextToSize(item.value, colWidth - 8).length * 4.2), 16));
    }
    ensureSpace(rowHeights.reduce((s, rh) => s + rh + 4, 0));
    let localY = y;
    labels.forEach((item, index) => {
      const rowIndex = Math.floor(index / 2);
      const colIndex = index % 2;
      const x = marginX + colIndex * (colWidth + gap);
      const boxH = rowHeights[rowIndex];
      sf(C.light); sd(C.border); doc.roundedRect(x, localY, colWidth, boxH, 3, 3, 'FD');
      st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(item.label.toUpperCase(), x + 4, localY + 5);
      st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      doc.text(doc.splitTextToSize(item.value, colWidth - 8), x + 4, localY + 10.5);
      if (colIndex === 1) localY += boxH + 4;
    });
    y = localY + 2;
  };

  const drawIndicatorCards = () => {
    drawSectionTitle('Resumo Financeiro', '', 'eyebrow');
    type Tone = 'default' | 'positive' | 'highlight' | 'accent' | 'negative';
    const cards: { label: string; value: string; tone: Tone }[] = [
      { label: 'Total Receitas',    value: formatCurrency(totalReceitas),  tone: 'positive' },
      { label: 'Total Despesas',    value: formatCurrency(totalDespesas),  tone: 'negative' },
      { label: 'Saldo Líquido',     value: formatCurrency(saldoLiquido),   tone: saldoLiquido >= 0 ? 'highlight' : 'accent' },
      { label: 'Total de Registros',value: `${totalRegistros} registro(s)`, tone: 'default' },
    ];
    const gap = 4, cols = 2;
    const cardWidth = (contentWidth - gap) / cols;
    const cardHeight = 20;
    let localY = y;
    cards.forEach((card, index) => {
      if (index % cols === 0) ensureSpace(cardHeight + 4);
      const cx = marginX + (index % cols) * (cardWidth + gap);
      const palette = card.tone === 'positive'
        ? { bg: C.greenSoft, text: C.green,    border: C.border }
        : card.tone === 'negative'
          ? { bg: C.roseSoft,  text: C.rose,     border: C.border }
          : card.tone === 'highlight'
            ? { bg: C.navySoft,  text: C.navy,     border: C.navy }
            : card.tone === 'accent'
              ? { bg: C.goldSoft,  text: C.gold,     border: C.border }
              : { bg: C.white,     text: C.graphite, border: C.border };
      sf(palette.bg); sd(palette.border); doc.roundedRect(cx, localY, cardWidth, cardHeight, 3, 3, 'FD');
      if (card.tone === 'highlight') { sf(C.navy); doc.roundedRect(cx, localY, cardWidth, 3, 3, 3, 'F'); }
      st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(card.label.toUpperCase(), cx + 4, localY + 7);
      st(palette.text); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(doc.splitTextToSize(card.value, cardWidth - 8), cx + 4, localY + 14);
      if (index % cols === cols - 1) localY += cardHeight + gap;
    });
    if (cards.length % cols !== 0) localY += cardHeight + gap;
    y = localY + 2;
  };

  const drawExtratoTable = () => {
    drawSectionTitle('Detalhamento', '', 'eyebrow');
    const extratoUnificado = [
      ...despesasData.map(item => ({ ...item, tipo: 'despesa' as const })),
      ...receitasData.map(item => ({ ...item, tipo: 'receita' as const })),
    ].sort((a, b) => {
      const da = new Date((a.tipo === 'despesa' ? a.data_pagamento : a.data_recebimento) || a.data_vencimento || '').getTime();
      const db = new Date((b.tipo === 'despesa' ? b.data_pagamento : b.data_recebimento) || b.data_vencimento || '').getTime();
      return da - db;
    });

    const columns = [
      { label: 'Data',               width: 20, align: 'center' as const },
      { label: 'Tipo',               width: 18, align: 'center' as const },
      { label: 'Fornecedor/Cliente', width: 42, align: 'left'   as const },
      { label: 'Projeto',            width: 35, align: 'left'   as const },
      { label: 'Valor',              width: 26, align: 'right'  as const },
      { label: 'Situação',           width: 20, align: 'center' as const },
      { label: 'Parcela',            width: 21, align: 'center' as const },
    ];
    const colX: number[] = [];
    let rx = marginX;
    columns.forEach(c => { colX.push(rx); rx += c.width; });

    const drawTableHeader = () => {
      ensureSpace(10);
      sf(C.navy); doc.rect(marginX, y, contentWidth, 8, 'F');
      st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      columns.forEach((col, i) => {
        const hx = col.align === 'right' ? colX[i] + col.width - 2 : col.align === 'center' ? colX[i] + col.width / 2 : colX[i] + 2;
        doc.text(col.label, hx, y + 5, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' });
      });
      y += 8;
    };

    drawTableHeader();

    extratoUnificado.forEach((item, index) => {
      const fornCliStr = String(item.tipo === 'despesa' ? (item.fornecedor_nome || '-') : ((item as any).cliente_nome || '-'));
      const fornCliLines = doc.splitTextToSize(fornCliStr, columns[2].width - 4);
      const projLines = doc.splitTextToSize(String(item.projeto_nome || '-'), columns[3].width - 4);
      const rowH = Math.max(7, Math.max(fornCliLines.length, projLines.length) * 4 + 4);

      if (y + rowH > pageHeight - bottomReserve) { addPage(); drawTableHeader(); }

      sf(index % 2 === 0 ? C.light : C.white); doc.rect(marginX, y, contentWidth, rowH, 'F');
      sd(C.border); doc.setLineWidth(0.15); doc.line(marginX, y + rowH, pageWidth - marginX, y + rowH);

      const ty = y + 5;
      const valor = Math.abs(Number(item.valor) || 0);

      // Data
      const dataExib = item.tipo === 'despesa' ? item.data_pagamento : (item as any).data_recebimento;
      st(C.graphite); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(fmtDate(dataExib || item.data_vencimento), colX[0] + columns[0].width / 2, ty, { align: 'center' });

      // Tipo badge
      sf(item.tipo === 'despesa' ? C.roseSoft : C.greenSoft);
      doc.roundedRect(colX[1] + 1, y + 1.5, 16, 5, 2, 2, 'F');
      st(item.tipo === 'despesa' ? C.rose : C.green); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(item.tipo === 'despesa' ? 'DESP' : 'REC', colX[1] + 9, y + 5.2, { align: 'center' });

      // Fornecedor/Cliente
      st(C.graphite); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(fornCliLines, colX[2] + 2, ty);

      // Projeto
      doc.text(projLines, colX[3] + 2, ty);

      // Valor
      st(item.tipo === 'despesa' ? C.rose : C.green); doc.setFont('helvetica', 'bold');
      const valorFmt = item.tipo === 'despesa' ? `(${formatCurrency(valor)})` : formatCurrency(valor);
      doc.text(valorFmt, colX[4] + columns[4].width - 2, ty, { align: 'right' });

      // Situação badge
      const sitStr = String(item.situacao_pagamento || '');
      const isQuitada = /quit|recebido|pago/i.test(sitStr);
      sf(isQuitada ? C.greenSoft : C.goldSoft);
      doc.roundedRect(colX[5] + 1, y + 1.5, 18, 5, 2, 2, 'F');
      st(isQuitada ? C.green : C.gold); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.text(sitStr.substring(0, 9), colX[5] + 10, y + 5.2, { align: 'center' });

      // Parcela
      st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(`${item.parcela}/${item.total_parcelas}`, colX[6] + columns[6].width / 2, ty, { align: 'center' });

      y += rowH;
    });

    // Totals row
    y += 3; ensureSpace(24);
    sf(C.light); sd(C.border); doc.setLineWidth(0.35);
    doc.rect(marginX, y, contentWidth, 22, 'FD');
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Totais', marginX + 4, y + 8);
    st(C.rose); doc.setFontSize(8.5);
    doc.text(`Despesas: (${formatCurrency(totalDespesas)})`, marginX + 4, y + 16);
    st(C.green);
    doc.text(`Receitas: ${formatCurrency(totalReceitas)}`, marginX + 62, y + 16);
    st(saldoLiquido >= 0 ? C.green : C.rose);
    doc.text(`Saldo: ${formatCurrency(saldoLiquido)}`, marginX + 120, y + 16);
    st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`${totalRegistros} registro(s)`, pageWidth - marginX - 4, y + 16, { align: 'right' });
    y += 26;
  };

  const drawOrcamentoSection = () => {
    if (!orcamentoData || orcamentoData.length === 0) return;
    drawSectionTitle('', 'Evolução do Orçamento', 'title');

    const columns = [
      { label: 'Descrição',     width: 39, align: 'left'   as const },
      { label: 'Data Prevista', width: 22, align: 'center' as const },
      { label: 'Valor Orçado',  width: 27, align: 'right'  as const },
      { label: 'Realizado',     width: 27, align: 'right'  as const },
      { label: 'Saldo',         width: 25, align: 'right'  as const },
      { label: 'Progresso',     width: 17, align: 'center' as const },
      { label: 'Status',        width: 25, align: 'center' as const },
    ];
    const colX: number[] = [];
    let rx = marginX; columns.forEach(c => { colX.push(rx); rx += c.width; });

    const drawOrcHeader = () => {
      ensureSpace(10);
      sf(C.navy); doc.rect(marginX, y, contentWidth, 8, 'F');
      st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      columns.forEach((col, i) => {
        const hx = col.align === 'right' ? colX[i] + col.width - 2 : col.align === 'center' ? colX[i] + col.width / 2 : colX[i] + 2;
        doc.text(col.label, hx, y + 5, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' });
      });
      y += 8;
    };
    drawOrcHeader();

    let totalOrcado = 0, totalRealizado = 0;
    orcamentoData.forEach((item, index) => {
      const descLines = doc.splitTextToSize(String(item.description || ''), columns[0].width - 4);
      const rowH = Math.max(7, descLines.length * 4 + 4);
      if (y + rowH > pageHeight - bottomReserve) { addPage(); drawOrcHeader(); }

      const vOrcado = Math.abs(Number(item.valor_orcado) || 0);
      const vRealizado = Math.abs(Number(item.valor_realizado) || 0);
      const saldo = vOrcado - vRealizado;
      const pct = vOrcado > 0 ? (vRealizado / vOrcado * 100) : 0;
      totalOrcado += vOrcado; totalRealizado += vRealizado;

      sf(index % 2 === 0 ? C.light : C.white); doc.rect(marginX, y, contentWidth, rowH, 'F');
      sd(C.border); doc.setLineWidth(0.15); doc.line(marginX, y + rowH, pageWidth - marginX, y + rowH);

      const ty = y + 5;
      st(C.graphite); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(descLines, colX[0] + 2, ty);
      doc.text(item.predicted_date ? fmtDate(item.predicted_date) : '-', colX[1] + columns[1].width / 2, ty, { align: 'center' });
      st(C.navy); doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(vOrcado), colX[2] + columns[2].width - 2, ty, { align: 'right' });
      st(C.green);
      doc.text(formatCurrency(vRealizado), colX[3] + columns[3].width - 2, ty, { align: 'right' });
      st(saldo >= 0 ? C.blue : C.rose);
      doc.text(formatCurrency(saldo), colX[4] + columns[4].width - 2, ty, { align: 'right' });
      st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.text(`${pct.toFixed(0)}%`, colX[5] + columns[5].width / 2, ty, { align: 'center' });
      const status = String(item.status || 'PENDENTE');
      st(status === 'CONCLUÍDO' ? C.green : status === 'EM ANDAMENTO' ? C.gold : C.slate); doc.setFontSize(6.5);
      doc.text(status.substring(0, 8), colX[6] + columns[6].width / 2, ty, { align: 'center' });
      y += rowH;
    });

    y += 3; ensureSpace(16);
    sf(C.navySoft); sd(C.border); doc.rect(marginX, y, contentWidth, 14, 'FD');
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Total Orçado:', colX[2] + columns[2].width - 2, y + 6, { align: 'right' });
    doc.text(formatCurrency(totalOrcado), colX[2] + columns[2].width - 2, y + 11, { align: 'right' });
    st(C.green);
    doc.text('Realizado:', colX[3] + columns[3].width - 2, y + 6, { align: 'right' });
    doc.text(formatCurrency(totalRealizado), colX[3] + columns[3].width - 2, y + 11, { align: 'right' });
    st((totalOrcado - totalRealizado) >= 0 ? C.blue : C.rose);
    doc.text('Saldo:', colX[4] + columns[4].width - 2, y + 6, { align: 'right' });
    doc.text(formatCurrency(totalOrcado - totalRealizado), colX[4] + columns[4].width - 2, y + 11, { align: 'right' });
    y += 18;
  };

  const drawAportesSection = () => {
    if (!aportesData || aportesData.length === 0) return;
    drawSectionTitle('', 'Evolução dos Aportes', 'title');

    // Columns: no "Tipo"
    const columns = [
      { label: 'Membro',        width: 58, align: 'left'   as const },
      { label: 'Data Previsão', width: 24, align: 'center' as const },
      { label: 'Previsto',      width: 28, align: 'right'  as const },
      { label: 'Realizado',     width: 28, align: 'right'  as const },
      { label: 'Saldo',         width: 24, align: 'right'  as const },
      { label: 'Progresso',     width: 15, align: 'center' as const },
      { label: 'Status',        width: 5,  align: 'center' as const },
    ];
    const colX: number[] = [];
    let rx = marginX; columns.forEach(c => { colX.push(rx); rx += c.width; });

    const drawAportHeader = () => {
      ensureSpace(10);
      sf(C.navy); doc.rect(marginX, y, contentWidth, 8, 'F');
      st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      columns.forEach((col, i) => {
        const hx = col.align === 'right' ? colX[i] + col.width - 2 : col.align === 'center' ? colX[i] + col.width / 2 : colX[i] + 2;
        doc.text(col.label, hx, y + 5, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' });
      });
      y += 8;
    };
    drawAportHeader();

    // Group by membro_nome (preserve insertion order)
    const groups = new Map<string, any[]>();
    (aportesData || []).forEach(item => {
      const key = String(item.membro_nome || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    const multipleMembers = groups.size > 1;
    let totalPrevisto = 0, totalRealizadoAp = 0;
    let globalRowIndex = 0;

    groups.forEach((items, membroNome) => {
      let groupPrevisto = 0, groupRealizado = 0;

      items.forEach((item) => {
        const rowH = 7;
        if (y + rowH > pageHeight - bottomReserve) { addPage(); drawAportHeader(); }

        const vPrev = Math.abs(Number(item.valor_previsto) || 0);
        const vReal = Math.abs(Number(item.valor_realizado) || 0);
        const saldo = vPrev - vReal;
        const pct = vPrev > 0 ? (vReal / vPrev * 100) : 0;
        groupPrevisto += vPrev; groupRealizado += vReal;
        totalPrevisto += vPrev; totalRealizadoAp += vReal;

        sf(globalRowIndex % 2 === 0 ? C.light : C.white); doc.rect(marginX, y, contentWidth, rowH, 'F');
        sd(C.border); doc.setLineWidth(0.15); doc.line(marginX, y + rowH, pageWidth - marginX, y + rowH);
        globalRowIndex++;

        const ty = y + 5;
        st(C.graphite); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        doc.text(doc.splitTextToSize(membroNome, columns[0].width - 4), colX[0] + 2, ty);
        doc.text(item.data_previsao ? fmtDate(item.data_previsao) : '-', colX[1] + columns[1].width / 2, ty, { align: 'center' });
        st(C.navy); doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(vPrev), colX[2] + columns[2].width - 2, ty, { align: 'right' });
        st(C.green);
        doc.text(formatCurrency(vReal), colX[3] + columns[3].width - 2, ty, { align: 'right' });
        st(saldo >= 0 ? C.blue : C.rose);
        doc.text(formatCurrency(saldo), colX[4] + columns[4].width - 2, ty, { align: 'right' });
        st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.text(`${pct.toFixed(0)}%`, colX[5] + columns[5].width / 2, ty, { align: 'center' });
        const status = String(item.status || 'PENDENTE');
        st(status === 'CONCLUÍDO' ? C.green : status === 'EM ANDAMENTO' ? C.gold : C.slate); doc.setFontSize(6.5);
        doc.text(status.substring(0, 3), colX[6] + columns[6].width / 2, ty, { align: 'center' });
        y += rowH;
      });

      // Subtotal per member (only when multiple members)
      if (multipleMembers) {
        ensureSpace(10);
        sf(C.navySoft); sd(C.border); doc.setLineWidth(0.2);
        doc.rect(marginX, y, contentWidth, 9, 'FD');
        st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        const truncName = membroNome.length > 28 ? membroNome.substring(0, 26) + '..' : membroNome;
        doc.text(`Subtotal — ${truncName}`, colX[0] + 2, y + 6);
        doc.text(formatCurrency(groupPrevisto), colX[2] + columns[2].width - 2, y + 6, { align: 'right' });
        st(C.green);
        doc.text(formatCurrency(groupRealizado), colX[3] + columns[3].width - 2, y + 6, { align: 'right' });
        const gSaldo = groupPrevisto - groupRealizado;
        st(gSaldo >= 0 ? C.blue : C.rose);
        doc.text(formatCurrency(gSaldo), colX[4] + columns[4].width - 2, y + 6, { align: 'right' });
        y += 12;
      }
    });

    // Grand total
    y += 3; ensureSpace(16);
    sf(C.navySoft); sd(C.border); doc.rect(marginX, y, contentWidth, 14, 'FD');
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Total Previsto:', colX[2] + columns[2].width - 2, y + 6, { align: 'right' });
    doc.text(formatCurrency(totalPrevisto), colX[2] + columns[2].width - 2, y + 11, { align: 'right' });
    st(C.green);
    doc.text('Realizado:', colX[3] + columns[3].width - 2, y + 6, { align: 'right' });
    doc.text(formatCurrency(totalRealizadoAp), colX[3] + columns[3].width - 2, y + 11, { align: 'right' });
    st((totalPrevisto - totalRealizadoAp) >= 0 ? C.blue : C.rose);
    doc.text('Saldo:', colX[4] + columns[4].width - 2, y + 6, { align: 'right' });
    doc.text(formatCurrency(totalPrevisto - totalRealizadoAp), colX[4] + columns[4].width - 2, y + 11, { align: 'right' });
    y += 18;
  };

  drawHeader();
  drawInfoBlock();
  drawIndicatorCards();
  drawExtratoTable();
  if (projetoInfo) {
    drawOrcamentoSection();
    drawAportesSection();
  }

  // Footer on all pages
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    sd(C.border); doc.setLineWidth(0.35);
    doc.line(marginX, pageHeight - 12.5, pageWidth - marginX, pageHeight - 12.5);
    st(C.slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('PROVISION', marginX, pageHeight - 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('Sistema de Gestão Financeira e Projetos', marginX + 19, pageHeight - 8);
    doc.text(`Emitido em ${issuedAtLabel}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Página ${page} de ${pages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  const safeFilename = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  doc.save(`${safeFilename}.pdf`);
}

// Interface específica para extrato do cliente
interface ExtratoClienteData {
  data_pagamento: string;
  projeto_nome?: string;
  valor: number;
  conta_corrente?: string;
  [key: string]: any;
}

// Interface para dados do extrato bancário
interface ExtratoBancarioData {
  data: string;
  tipo: string;
  fornecedor_creditor: string;
  numero_documento?: string;
  projeto?: string;
  matriz_nome?: string;
  valor: number;
  saldo_linha?: number;
  [key: string]: any;
}

// Função específica para PDF do extrato bancário — visual premium
export function exportExtratoBancarioPDF(
  data: ExtratoBancarioData[],
  filename: string,
  contaInfo: {
    conta_nome: string;
    conta_banco: string;
    saldo_anterior: number;
  },
  filtros: {
    dataInicio: string;
    dataFim: string;
    tipo?: string;
    matrizNome?: string;
  },
  formatCurrency: (value: number) => string,
  formatDate: (date: string) => string,
) {
  type RGB = [number, number, number];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageWidth - marginX * 2;
  let y = 0;

  const P: Record<string, RGB> = {
    navy:     [17,  31,  59],
    navySoft: [229, 236, 246],
    graphite: [59,  68,  82],
    slate:    [107, 114, 128],
    border:   [217, 223, 232],
    light:    [245, 247, 250],
    white:    [255, 255, 255],
    green:    [22,  101, 52],
    rose:     [190, 24,  93],
  };

  const sf = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const sd = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const st = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const now = new Date();
  const issuedAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(now);

  // Compute summary from data
  const saldoAnterior   = Number(contaInfo.saldo_anterior) || 0;
  const totalEntradas   = data.reduce((s, t) => s + (Number(t.entrada) || (Number(t.valor) > 0 ? Number(t.valor) : 0)), 0);
  const totalSaidas     = data.reduce((s, t) => s + (Number(t.saida)   || (Number(t.valor) < 0 ? Math.abs(Number(t.valor)) : 0)), 0);
  const saldoFinal      = data.length > 0 ? (Number(data[data.length - 1].saldo_linha) || 0) : saldoAnterior;

  // Column definitions — total must equal contentW (297 - 28 = 269 mm)
  const cols = [
    { label: 'Data',                    width: 22, right: false },
    { label: 'Tipo',                    width: 24, right: false },
    { label: 'Histórico / Favorecido',  width: 60, right: false },
    { label: 'Nº Doc',                  width: 22, right: false },
    { label: 'Projeto',                 width: 32, right: false },
    { label: 'Matriz',                  width: 25, right: false },
    { label: 'Entrada',                 width: 32, right: true  },
    { label: 'Saída',                   width: 32, right: true  },
    { label: 'Saldo',                   width: 20, right: true  },
  ] as const;  // sum = 269 mm ✓

  const ROW_H    = 7.5;
  const HEADER_H = 8;

  const drawTableHeader = (yh: number): number => {
    sf(P.navy); doc.rect(marginX, yh, contentW, HEADER_H, 'F');
    let cx = marginX;
    cols.forEach((col) => {
      st(P.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      const xText = col.right ? cx + col.width - 2 : cx + 2;
      doc.text(col.label, xText, yh + 5.5, { align: col.right ? 'right' : 'left' });
      cx += col.width;
    });
    return yh + HEADER_H;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      doc.addPage();
      y = 14;
      y = drawTableHeader(y);
    }
  };

  // ── HEADER BAR ────────────────────────────────────────────
  sf(P.navy); doc.rect(0, 0, pageWidth, 22, 'F');
  st(P.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('EXTRATO BANCÁRIO', marginX, 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const contaLabel = contaInfo.conta_nome + (contaInfo.conta_banco ? ` — ${contaInfo.conta_banco}` : '');
  doc.text(contaLabel, marginX, 17);
  st(P.navySoft); doc.setFontSize(7.5);
  doc.text(`Emitido em ${issuedAt}`, pageWidth - marginX, 17, { align: 'right' });

  y = 28;

  // ── FILTER INFO BLOCK ──────────────────────────────────────
  const infoItems: [string, string][] = [
    ['Período', `${filtros.dataInicio} – ${filtros.dataFim}`],
    ['Tipo',    filtros.tipo || 'Todos'],
    ...(filtros.matrizNome ? [['Matriz', filtros.matrizNome] as [string, string]] : []),
  ];
  const infoW = contentW / infoItems.length;
  infoItems.forEach(([label, val], i) => {
    const x = marginX + i * infoW;
    sf(P.light); doc.roundedRect(x, y, infoW - 2, 13, 2, 2, 'F');
    st(P.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    st(P.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text(val, x + 3, y + 11);
  });
  y += 18;

  // ── SUMMARY CARDS ──────────────────────────────────────────
  const cards = [
    { label: 'Saldo Anterior',  value: formatCurrency(saldoAnterior), color: P.graphite },
    { label: 'Total Entradas',  value: formatCurrency(totalEntradas), color: P.green    },
    { label: 'Total Saídas',    value: formatCurrency(totalSaidas),   color: P.rose     },
    { label: 'Saldo Final',     value: formatCurrency(saldoFinal),    color: saldoFinal < 0 ? P.rose : P.green },
    { label: 'Movimentações',   value: String(data.length),           color: P.navy     },
  ];
  const cardW = contentW / cards.length;
  cards.forEach((card, i) => {
    const x = marginX + i * cardW;
    sf(P.light); doc.roundedRect(x, y, cardW - 2, 17, 2, 2, 'F');
    st(P.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.text(card.label.toUpperCase(), x + 3, y + 6);
    st(card.color); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(card.value, x + 3, y + 14);
  });
  y += 22;

  // ── TABLE ─────────────────────────────────────────────────
  y = drawTableHeader(y);

  data.forEach((item, idx) => {
    ensureSpace(ROW_H + 1);

    // Zebra rows
    sf(idx % 2 === 0 ? P.white : P.light);
    doc.rect(marginX, y, contentW, ROW_H, 'F');

    const valor      = Number(item.valor)      || 0;
    const entrada    = Number(item.entrada)    || (valor > 0 ? valor : 0);
    const saida      = Number(item.saida)      || (valor < 0 ? Math.abs(valor) : 0);
    const saldoLinha = Number(item.saldo_linha) || 0;

    const cells: { text: string; color: RGB; bold?: boolean }[] = [
      { text: formatDate(item.data),                         color: P.graphite, bold: true  },
      { text: String(item.tipo || ''),                       color: P.graphite              },
      { text: String(item.fornecedor_creditor || '—'),       color: P.graphite              },
      { text: String(item.numero_documento    || '—'),       color: P.graphite              },
      { text: String(item.projeto             || '—'),       color: P.graphite              },
      { text: String(item.matriz_nome         || '—'),       color: P.graphite              },
      { text: entrada > 0 ? formatCurrency(entrada)  : '—', color: entrada > 0 ? P.green : P.slate  },
      { text: saida   > 0 ? formatCurrency(saida)    : '—', color: saida   > 0 ? P.rose  : P.slate  },
      { text: formatCurrency(saldoLinha),                    color: saldoLinha < 0 ? P.rose : P.graphite, bold: true },
    ];

    let cx = marginX;
    cells.forEach((cell, ci) => {
      const col = cols[ci];
      st(cell.color);
      doc.setFont('helvetica', cell.bold ? 'bold' : 'normal');
      doc.setFontSize(7);
      const fitted = doc.splitTextToSize(cell.text, col.width - 4);
      const xText = col.right ? cx + col.width - 2 : cx + 2;
      doc.text(fitted[0], xText, y + 5, { align: col.right ? 'right' : 'left' });
      cx += col.width;
    });

    // Row separator
    sd(P.border); doc.setLineWidth(0.1);
    doc.line(marginX, y + ROW_H, marginX + contentW, y + ROW_H);
    y += ROW_H;
  });

  // ── TOTALS ROW ─────────────────────────────────────────────
  ensureSpace(9);
  sf(P.navySoft); doc.rect(marginX, y, contentW, 9, 'F');
  st(P.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text(`TOTAL — ${data.length} movimentaç${data.length !== 1 ? 'ões' : 'ão'}`, marginX + 2, y + 6);
  let cx2 = marginX;
  cols.forEach((col, ci) => {
    if (ci === 6) { st(P.green);  doc.text(formatCurrency(totalEntradas), cx2 + col.width - 2, y + 6, { align: 'right' }); }
    if (ci === 7) { st(P.rose);   doc.text(formatCurrency(totalSaidas),   cx2 + col.width - 2, y + 6, { align: 'right' }); }
    if (ci === 8) { st(saldoFinal < 0 ? P.rose : P.navy); doc.text(formatCurrency(saldoFinal), cx2 + col.width - 2, y + 6, { align: 'right' }); }
    cx2 += col.width;
  });
  y += 9;

  // ── FOOTER ON ALL PAGES ────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    sd(P.border); doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);
    st(P.slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text('PROVISION', marginX, pageHeight - 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(' Sistema de Gestão Financeira e Projetos', marginX + 16, pageHeight - 5.5);
    doc.text(`Emitido em ${issuedAt}`, pageWidth / 2, pageHeight - 5.5, { align: 'center' });
    doc.text(`Página ${p} de ${pages}`, pageWidth - marginX, pageHeight - 5.5, { align: 'right' });
  }

  const safeFilename = (filename || 'extrato')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  doc.save(`${safeFilename}.pdf`);

}

// Função específica para PDF do Relatório Projetos Geral
export function exportRelatorioProjetosGeralPDF(
  dadosRelatorio: any[],
  filename: string,
  formatCurrency: (value: number) => string,
  filtros: {
    projetoIds?: number[];
    dataPagamentoInicio?: string | null;
    dataPagamentoFim?: string | null;
  },
  totalReceitas: number,
  totalDespesas: number,
  saldoGeral: number,
  projetos?: any[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'RELATÓRIO PROJETOS GERAL';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Informações dos filtros aplicados
  let yPos = 45;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // Projetos selecionados
  if (filtros.projetoIds && filtros.projetoIds.length > 0 && projetos) {
    if (filtros.projetoIds.length === projetos.length) {
      doc.text('Projetos: Todos os projetos', 14, yPos);
    } else {
      const nomesProjetos = filtros.projetoIds.map(id => 
        projetos.find((p: any) => p.id === id)?.name || `ID ${id}`
      );
      const textoLimitado = nomesProjetos.length <= 3 
        ? `Projetos: ${nomesProjetos.join(', ')}`
        : `Projetos: ${nomesProjetos.slice(0, 2).join(', ')} e mais ${nomesProjetos.length - 2}`;
      doc.text(textoLimitado, 14, yPos);
    }
    yPos += 5;
  }
  
  if (filtros.dataPagamentoInicio || filtros.dataPagamentoFim) {
    const periodo = `Período Pagamento: ${filtros.dataPagamentoInicio ? new Date(filtros.dataPagamentoInicio).toLocaleDateString('pt-BR') : 'Início'} até ${filtros.dataPagamentoFim ? new Date(filtros.dataPagamentoFim).toLocaleDateString('pt-BR') : 'Atual'}`;
    doc.text(periodo, 14, yPos);
    yPos += 5;
  }
  
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 15;

  // 4. Cards de resumo (como na tela)
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('RESUMO GERAL', 14, yPos);
  yPos += 10;

  // Background para o resumo
  doc.setFillColor(248, 249, 250);
  doc.rect(14, yPos - 5, pageWidth - 28, 25, 'F');

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Total Receitas:', 20, yPos);
  doc.setTextColor(34, 197, 94); // Verde
  doc.setFont(undefined, 'bold');
  doc.text(formatCurrency(totalReceitas), 70, yPos);

  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text('Total Despesas:', 20, yPos);
  doc.setTextColor(239, 68, 68); // Vermelho
  doc.setFont(undefined, 'bold');
  doc.text(formatCurrency(totalDespesas), 70, yPos);

  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text('Saldo Geral:', 20, yPos);
  doc.setTextColor(saldoGeral >= 0 ? 34 : 239, saldoGeral >= 0 ? 197 : 68, saldoGeral >= 0 ? 94 : 68);
  doc.setFont(undefined, 'bold');
  doc.text(formatCurrency(saldoGeral), 70, yPos);

  yPos += 20;
  doc.setTextColor(0, 0, 0);

  // 5. Tabela principal (igual à tela)
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Relatório por Projeto (${dadosRelatorio.length} projetos)`, 14, yPos);
  yPos += 15;

  // Cabeçalho da tabela com cores
  doc.setFillColor(52, 73, 93);
  doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Projeto', 18, yPos);
  doc.text('Valor Receitas', 80, yPos);
  doc.text('Valor Despesas', 115, yPos);
  doc.text('Saldo', 150, yPos);
  doc.text('Status', 175, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  // Dados da tabela com linhas alternadas (igual à tela)
  dadosRelatorio.forEach((item, index) => {
    // Verificar se precisa de nova página
    if (yPos > 260) {
      doc.addPage();
      yPos = 25;
      
      // Repetir cabeçalho na nova página
      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Projeto', 18, yPos);
      doc.text('Valor Receitas', 80, yPos);
      doc.text('Valor Despesas', 115, yPos);
      doc.text('Saldo', 150, yPos);
      doc.text('Status', 175, yPos);
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    // Linha alternada de cor (igual à tela)
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
    }
    
    const valorReceitas = item.valor_receitas || 0;
    const valorDespesas = item.valor_despesas || 0;
    const saldo = item.saldo || 0;
    
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    // Projeto
    const nomeProjeto = String(item.projeto_nome || '');
    doc.text(nomeProjeto.length > 25 ? nomeProjeto.substring(0, 22) + '...' : nomeProjeto, 18, yPos);
    
    // Valor Receitas (verde, como na tela)
    doc.setTextColor(34, 197, 94);
    doc.setFont(undefined, 'normal');
    doc.text(formatCurrency(valorReceitas), 80, yPos);
    
    // Valor Despesas (vermelho, como na tela)
    doc.setTextColor(239, 68, 68);
    doc.text(formatCurrency(valorDespesas), 115, yPos);
    
    // Saldo (verde se positivo, vermelho se negativo, como na tela)
    doc.setTextColor(saldo >= 0 ? 34 : 239, saldo >= 0 ? 197 : 68, saldo >= 0 ? 94 : 68);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(saldo), 150, yPos);
    
    // Status (como na tela)
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    let status = 'Equilibrado';
    if (saldo > 0) status = 'Positivo';
    else if (saldo < 0) status = 'Negativo';
    doc.text(status, 175, yPos);
    
    yPos += 10;
  });
  
  // Linha de separação antes do total
  yPos += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 10;
  
  // Verificar se precisa de nova página para o total
  if (yPos > 260) {
    doc.addPage();
    yPos = 30;
  }
  
  // Linha TOTAL GERAL (igual à tela - com fundo cinza)
  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos - 4, pageWidth - 28, 12, 'F');
  
  // Borda mais grossa para o total
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.rect(14, yPos - 4, pageWidth - 28, 12);
  doc.setLineWidth(0.2); // Reset line width
  
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  
  // TOTAL GERAL
  doc.text('TOTAL GERAL', 18, yPos + 4);
  
  // Total Receitas (verde)
  doc.setTextColor(34, 197, 94);
  doc.text(formatCurrency(totalReceitas), 80, yPos + 4);
  
  // Total Despesas (vermelho)
  doc.setTextColor(239, 68, 68);
  doc.text(formatCurrency(totalDespesas), 115, yPos + 4);
  
  // Saldo Geral (verde se positivo, vermelho se negativo)
  doc.setTextColor(saldoGeral >= 0 ? 34 : 239, saldoGeral >= 0 ? 197 : 68, saldoGeral >= 0 ? 94 : 68);
  doc.text(formatCurrency(saldoGeral), 150, yPos + 4);
  
  // Status Total
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  let statusGeral = 'Equilibrado';
  if (saldoGeral > 0) statusGeral = 'Positivo';
  else if (saldoGeral < 0) statusGeral = 'Negativo';
  doc.text(statusGeral, 175, yPos + 4);
  
  yPos += 20;
  
  // Informação de número de projetos
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total de ${dadosRelatorio.length} projeto(s) com movimentações`, 14, yPos);
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }
  
  // Download
  doc.save(`${filename}.pdf`);
}

// Função específica para PDF com gráficos do Relatório por Projeto
export function exportChartsOnlyToPDF(
  despesasPorGrupo: Array<{ grupo_nome: string; valor_total: number }>,
  receitasPorCliente: Array<{ cliente_nome: string; valor_total: number }>,
  filename: string,
  formatCurrency: (value: number) => string,
  projetoInfo: { name: string }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'RELATÓRIO DESPESAS E APORTES';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Nome do projeto
  let yPos = 45;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Projeto: ${projetoInfo.name}`, 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 20;

  // ==================== GRÁFICO 1: DESPESAS POR GRUPO ====================
  if (despesasPorGrupo.length > 0) {
    // Título do gráfico
    doc.setFillColor(239, 68, 68);
    doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('DESPESAS', 18, yPos);
    yPos += 20;
    
    // Configurações do gráfico VERTICAL
    const graphX = 25;
    const graphY = yPos;
    const graphWidth = pageWidth - 50;
    const graphHeight = 100;
    const numGrupos = despesasPorGrupo.length;
    const barSpacing = 5;
    const barWidth = Math.min((graphWidth - (numGrupos - 1) * barSpacing) / numGrupos, 25);
    
    // Encontrar valor máximo para escala vertical
    const maxValorDespesas = Math.max(...despesasPorGrupo.map(g => g.valor_total));
    
    // Desenhar eixo horizontal (linha base)
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(graphX, graphY + graphHeight, graphX + graphWidth, graphY + graphHeight);
    
    // Desenhar barras verticais
    despesasPorGrupo.forEach((grupo, index) => {
      const barX = graphX + index * (barWidth + barSpacing);
      const barHeightPercent = maxValorDespesas > 0 ? (grupo.valor_total / maxValorDespesas) : 0;
      const barHeightCalc = graphHeight * barHeightPercent;
      const barY = graphY + graphHeight - barHeightCalc;
      
      // Barra vertical (vermelha)
      doc.setFillColor(239, 68, 68);
      doc.rect(barX, barY, barWidth, barHeightCalc, 'F');
      
      // Borda da barra
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.3);
      doc.rect(barX, barY, barWidth, barHeightCalc);
      doc.setLineWidth(0.2);
      
      // Valor acima da barra
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      const valorTexto = formatCurrency(grupo.valor_total);
      const valorWidth = doc.getTextWidth(valorTexto);
      doc.text(valorTexto, barX + (barWidth - valorWidth) / 2, barY - 3);
      
      // Nome do grupo abaixo do eixo
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      
      const nomeMax = Math.floor(barWidth / 1.5);
      const nomeGrupo = grupo.grupo_nome.length > nomeMax 
        ? grupo.grupo_nome.substring(0, nomeMax - 2) + '..' 
        : grupo.grupo_nome;
      
      const nomeWidth = doc.getTextWidth(nomeGrupo);
      
      if (nomeWidth > barWidth) {
        doc.setFontSize(6);
        const nomeAbreviado = grupo.grupo_nome.substring(0, 8);
        doc.text(nomeAbreviado, barX, graphY + graphHeight + 8);
      } else {
        doc.text(nomeGrupo, barX + (barWidth - nomeWidth) / 2, graphY + graphHeight + 8);
      }
    });
    
    yPos = graphY + graphHeight + 20;
    
    // Total geral das despesas
    const totalDespesas = despesasPorGrupo.reduce((sum, g) => sum + g.valor_total, 0);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(239, 68, 68);
    doc.text(`Total de Despesas: ${formatCurrency(totalDespesas)}`, graphX, yPos);
    
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${despesasPorGrupo.length} grupo(s) com despesas`, graphX, yPos);
    
    yPos += 30;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhuma despesa encontrada para este projeto.', 14, yPos);
    yPos += 20;
  }

  // ==================== GRÁFICO 2: RECEITAS POR CLIENTE ====================
  // Nova página se necessário
  if (yPos > 100) {
    doc.addPage();
    yPos = 25;
  }
  
  if (receitasPorCliente.length > 0) {
    // Título do gráfico
    doc.setFillColor(34, 197, 94);
    doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('APORTES', 18, yPos);
    yPos += 20;
    
    // Configurações do gráfico VERTICAL
    const graphX = 25;
    const graphY = yPos;
    const graphWidth = pageWidth - 50;
    const graphHeight = 100;
    const numClientes = receitasPorCliente.length;
    const barSpacing = 5;
    const barWidth = Math.min((graphWidth - (numClientes - 1) * barSpacing) / numClientes, 25);
    
    // Encontrar valor máximo para escala vertical
    const maxValorReceitas = Math.max(...receitasPorCliente.map(c => c.valor_total));
    
    // Desenhar eixo horizontal (linha base)
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(graphX, graphY + graphHeight, graphX + graphWidth, graphY + graphHeight);
    
    // Desenhar barras verticais
    receitasPorCliente.forEach((cliente, index) => {
      const barX = graphX + index * (barWidth + barSpacing);
      const barHeightPercent = maxValorReceitas > 0 ? (cliente.valor_total / maxValorReceitas) : 0;
      const barHeightCalc = graphHeight * barHeightPercent;
      const barY = graphY + graphHeight - barHeightCalc;
      
      // Barra vertical (verde)
      doc.setFillColor(34, 197, 94);
      doc.rect(barX, barY, barWidth, barHeightCalc, 'F');
      
      // Borda da barra
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.3);
      doc.rect(barX, barY, barWidth, barHeightCalc);
      doc.setLineWidth(0.2);
      
      // Valor acima da barra
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      const valorTexto = formatCurrency(cliente.valor_total);
      const valorWidth = doc.getTextWidth(valorTexto);
      doc.text(valorTexto, barX + (barWidth - valorWidth) / 2, barY - 3);
      
      // Nome do cliente abaixo do eixo
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      
      const nomeMax = Math.floor(barWidth / 1.5);
      const nomeCliente = cliente.cliente_nome.length > nomeMax 
        ? cliente.cliente_nome.substring(0, nomeMax - 2) + '..' 
        : cliente.cliente_nome;
      
      const nomeWidth = doc.getTextWidth(nomeCliente);
      
      if (nomeWidth > barWidth) {
        doc.setFontSize(6);
        const nomeAbreviado = cliente.cliente_nome.substring(0, 8);
        doc.text(nomeAbreviado, barX, graphY + graphHeight + 8);
      } else {
        doc.text(nomeCliente, barX + (barWidth - nomeWidth) / 2, graphY + graphHeight + 8);
      }
    });
    
    yPos = graphY + graphHeight + 20;
    
    // Total geral das receitas
    const totalReceitas = receitasPorCliente.reduce((sum, c) => sum + c.valor_total, 0);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);
    doc.text(`Total de Receitas: ${formatCurrency(totalReceitas)}`, graphX, yPos);
    
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${receitasPorCliente.length} cliente(s) com receitas`, graphX, yPos);
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhuma receita encontrada para este projeto.', 14, yPos);
  }

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }

  // Download file
  doc.save(`${filename}.pdf`);
}

// Função específica para PDF do extrato do cliente
export function exportExtratoClientePDF(
  data: ExtratoClienteData[],
  filename: string,
  clienteNome: string,
  filtros: {
    projetoNome?: string;
    contaNome?: string;
    dataInicio?: string;
    dataFim?: string;
  },
  formatCurrency: (value: number) => string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // 1. Logo e nome do sistema no canto superior esquerdo
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('PROVISON', 14, 15);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Sistema de Gestão Financeira', 14, 20);
  
  // 2. Título centralizado no cabeçalho
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  const titulo = 'EXTRATO DO CLIENTE';
  const tituloWidth = doc.getTextWidth(titulo);
  doc.text(titulo, (pageWidth - tituloWidth) / 2, 30);
  
  // 3. Nome do cliente e filtros aplicados
  let yPos = 45;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Cliente: ${clienteNome}`, 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // Exibir filtros aplicados
  if (filtros.projetoNome) {
    doc.text(`Projeto: ${filtros.projetoNome}`, 14, yPos);
    yPos += 5;
  }
  
  if (filtros.contaNome) {
    doc.text(`Conta: ${filtros.contaNome}`, 14, yPos);
    yPos += 5;
  }
  
  if (filtros.dataInicio || filtros.dataFim) {
    const periodo = `Período: ${
      filtros.dataInicio ? new Date(filtros.dataInicio).toLocaleDateString('pt-BR') : 'Início'
    } até ${
      filtros.dataFim ? new Date(filtros.dataFim).toLocaleDateString('pt-BR') : 'Atual'
    }`;
    doc.text(periodo, 14, yPos);
    yPos += 5;
  }
  
  doc.text(`Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, yPos);
  yPos += 15;
  
  // 4. Dados em formato tabular igual à tela
  // Cabeçalho da tabela com cores
  doc.setFillColor(52, 73, 93);
  doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Data de Pagamento', 18, yPos);
  doc.text('Projeto', 70, yPos);
  doc.text('Valor', 130, yPos);
  doc.text('Conta Corrente', 165, yPos);
  
  yPos += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  // Função para formatar data
  const formatDate = (date: string | null) => {
    return date ? new Date(date).toLocaleDateString('pt-BR') : '-';
  };
  
  let total = 0;
  
  // Dados da tabela com linhas alternadas
  data.forEach((item, index) => {
    // Verificar se precisa de nova página
    if (yPos > 270) {
      doc.addPage();
      yPos = 25;
      
      // Repetir cabeçalho na nova página
      doc.setFillColor(52, 73, 93);
      doc.rect(14, yPos - 6, pageWidth - 28, 12, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Data de Pagamento', 18, yPos);
      doc.text('Projeto', 70, yPos);
      doc.text('Valor', 130, yPos);
      doc.text('Conta Corrente', 165, yPos);
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }
    
    // Linha alternada de cor (igual à tela)
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(14, yPos - 4, pageWidth - 28, 10, 'F');
    }
    
    const valor = parseFloat(item.valor?.toString() || '0') || 0;
    total += valor;
    
    doc.setFontSize(9);
    doc.text(formatDate(item.data_pagamento), 18, yPos);
    doc.text((item.projeto_nome || '-').substring(0, 25), 70, yPos);
    
    // Valor em verde (igual à tela)
    doc.setTextColor(34, 197, 94);
    doc.setFont(undefined, 'bold');
    doc.text(formatCurrency(valor), 130, yPos);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.text((item.conta_corrente || '-').substring(0, 20), 165, yPos);
    
    yPos += 10;
  });
  
  // Linha de separação e total
  yPos += 10;
  if (yPos > 270) {
    doc.addPage();
    yPos = 30;
  }
  
  doc.setDrawColor(0, 0, 0);
  doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);
  
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL GERAL:', 100, yPos);
  doc.setTextColor(34, 197, 94);
  doc.text(formatCurrency(total), 140, yPos);
  
  // Informação de número de registros
  yPos += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Total de ${data.length} movimentação(ões) encontrada(s)`, 14, yPos);
  
  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 35, doc.internal.pageSize.height - 10);
    doc.text('PROVISON - Sistema de Gestão Financeira', 14, doc.internal.pageSize.height - 10);
  }
  
  // Download
  doc.save(`${filename}.pdf`);
}
