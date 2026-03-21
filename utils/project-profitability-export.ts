import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

import type { ProfitabilityReportResult } from '@/utils/project-profitability';
import { formatDateForDisplay } from '@/utils/timezone';

type ExportContext = {
  formatCurrency: (value: number) => string;
  formatPercent: (value: number | null | undefined) => string;
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

function formatDateTimeForDisplay(date: Date) {
  const datePart = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return `${datePart} às ${timePart}`;
}

function sanitizeFilenamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildExecutiveSummary(
  report: ProfitabilityReportResult,
  formatCurrency: ExportContext['formatCurrency'],
  formatPercent: ExportContext['formatPercent'],
) {
  const selectedMembersLabel = report.viewType === 'project_total'
    ? 'todo o projeto'
    : (report.selectedMemberNames.join(', ') || 'os membros selecionados');

  return [
    `Considerando os aportes realizados e os aportes futuros simulados incluídos nesta análise para ${selectedMembersLabel}, o investimento total projetado alcança ${formatCurrency(report.totalInvestidoGeral)}.`,
    `Do montante analisado, ${formatCurrency(report.totalInvestidoReal)} correspondem a aportes reais e ${formatCurrency(report.totalAportesFuturos)} referem-se a aportes futuros simulados.`,
    `Com lucro líquido considerado de ${formatCurrency(report.lucroConsiderado)}, o valor final estimado de saída é de ${formatCurrency(report.valorSaida)} na data de ${formatDateForDisplay(report.exitDate)}.`,
    `A rentabilidade simples apurada é de ${formatPercent(report.rentabilidadeSimples)}, com TIR anual de ${formatPercent(report.tirAnual)} e taxa equivalente total no período de ${formatPercent(report.taxaEquivalentePeriodo)}.`,
  ];
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

export function exportProjectProfitabilityExcel(
  report: ProfitabilityReportResult,
  { formatCurrency, formatPercent }: ExportContext,
) {
  const summaryRows = [
    { Campo: 'Projeto', Valor: report.projectName },
    { Campo: 'Tipo de visualização', Valor: report.viewType === 'project_total' ? 'Projeto total' : 'Por membros' },
    { Campo: 'Membros selecionados', Valor: report.selectedMemberNames.join(', ') || '-' },
    { Campo: 'Data final de saída', Valor: formatDateForDisplay(report.exitDate) },
    { Campo: 'Lucro líquido informado', Valor: formatCurrency(report.lucroLiquidoInformado) },
    { Campo: 'Lucro considerado', Valor: formatCurrency(report.lucroConsiderado) },
    { Campo: 'Percentual total considerado', Valor: report.percentualTotalConsiderado === null ? '-' : formatPercent(report.percentualTotalConsiderado / 100) },
    { Campo: 'Total investido real', Valor: formatCurrency(report.totalInvestidoReal) },
    { Campo: 'Total aportes futuros simulados', Valor: formatCurrency(report.totalAportesFuturos) },
    { Campo: 'Total investido geral', Valor: formatCurrency(report.totalInvestidoGeral) },
    { Campo: 'Valor final de saída', Valor: formatCurrency(report.valorSaida) },
    { Campo: 'Rentabilidade simples', Valor: formatPercent(report.rentabilidadeSimples) },
    { Campo: 'TIR anual', Valor: formatPercent(report.tirAnual) },
    { Campo: 'Taxa equivalente total do período', Valor: formatPercent(report.taxaEquivalentePeriodo) },
    { Campo: 'Dias totais', Valor: report.diasTotal },
  ];

  const flowRows = report.flows.map((flow) => ({
    Data: formatDateForDisplay(flow.date),
    Tipo: flow.typeLabel,
    Membro: flow.memberName || '-',
    '% Participação': flow.participationPercentage === null ? '-' : formatPercent(flow.participationPercentage / 100),
    'Valor do Fluxo': flow.amount,
    'Valor Exibido': formatCurrency(flow.amount),
    'Dias até a saída': flow.daysToExit,
    'Anos equivalentes': flow.equivalentYears.toFixed(4),
    Observação: flow.observation || '-',
  }));

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 32 }, { wch: 40 }];

  const flowsSheet = XLSX.utils.json_to_sheet(flowRows);
  flowsSheet['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
  XLSX.utils.book_append_sheet(workbook, flowsSheet, 'Fluxos de Caixa');

  const filename = `rentabilidade_projeto_${report.projectName.replace(/[^a-zA-Z0-9]+/g, '_')}_${report.exitDate}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportProjectProfitabilityPDF(
  report: ProfitabilityReportResult,
  { formatCurrency, formatPercent }: ExportContext,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const topStart = 14;
  const bottomReserve = 18;
  const emittedAt = new Date();
  const issuedAtLabel = formatDateTimeForDisplay(emittedAt);
  const summarySentences = buildExecutiveSummary(report, formatCurrency, formatPercent);
  let y = topStart;

  const addPage = () => {
    doc.addPage();
    y = topStart;
  };

  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded <= pageHeight - bottomReserve) {
      return;
    }

    addPage();
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

  const drawHeader = () => {
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
    doc.setFontSize(18);
    doc.text('Relatório de Rentabilidade do Projeto', marginX + 28, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(report.projectName, marginX + 28, y + 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Emitido em ${issuedAtLabel}`, marginX + 28, y + 30);

    setFill(doc, [255, 255, 255]);
    doc.roundedRect(pageWidth - marginX - 42, y + 21, 38, 8, 3, 3, 'F');
    setText(doc, COLORS.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Análise de Rentabilidade', pageWidth - marginX - 23, y + 26.2, { align: 'center' });

    y += headerHeight + 4;
    setDraw(doc, COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  };

  const drawInfoBlock = () => {
    drawSectionTitle('Identificação', 'Dados do Relatório');

    const labels = [
      { label: 'Projeto', value: report.projectName },
      { label: 'Tipo de visualização', value: report.viewType === 'project_total' ? 'Projeto total' : 'Por membros' },
      { label: 'Membros considerados', value: report.selectedMemberNames.join(', ') || '-' },
      { label: 'Data final de saída', value: formatDateForDisplay(report.exitDate) },
      { label: 'Lucro líquido informado', value: formatCurrency(report.lucroLiquidoInformado) },
      { label: 'Lucro considerado', value: formatCurrency(report.lucroConsiderado) },
      { label: 'Percentual total considerado', value: report.percentualTotalConsiderado === null ? '-' : formatPercent(report.percentualTotalConsiderado / 100) },
      { label: 'Prazo total analisado', value: `${report.diasTotal} dias` },
    ];

    const gap = 5;
    const colWidth = (contentWidth - gap) / 2;
    const rowHeights: number[] = [];

    for (let index = 0; index < labels.length; index += 2) {
      const pair = labels.slice(index, index + 2);
      const rowHeight = pair.reduce((height, item) => {
        const valueLines = doc.splitTextToSize(item.value, colWidth - 8);
        return Math.max(height, 10 + valueLines.length * 4.2);
      }, 16);
      rowHeights.push(rowHeight);
    }

    ensureSpace(rowHeights.reduce((sum, height) => sum + height + 4, 0));

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

      if (colIndex === 1) {
        localY += boxHeight + 4;
      }
    });

    y = localY + 2;
  };

  const drawMetricCard = (
    x: number,
    cardY: number,
    width: number,
    height: number,
    label: string,
    value: string,
    tone: 'default' | 'positive' | 'highlight' | 'accent' = 'default',
  ) => {
    const palette = tone === 'positive'
      ? { bg: COLORS.greenSoft, text: COLORS.green, border: COLORS.border }
      : tone === 'highlight'
        ? { bg: COLORS.navySoft, text: COLORS.navy, border: COLORS.navy }
        : tone === 'accent'
          ? { bg: COLORS.goldSoft, text: COLORS.gold, border: COLORS.border }
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

  const drawIndicatorCards = () => {
    drawSectionTitle('Indicadores', 'Painel Executivo');

    const gap = 4;
    const cols = 2;
    const cardWidth = (contentWidth - gap) / cols;
    const cardHeight = 20;
    const cards = [
      { label: 'Total investido real', value: formatCurrency(report.totalInvestidoReal), tone: 'default' as const },
      { label: 'Aportes futuros simulados', value: formatCurrency(report.totalAportesFuturos), tone: 'default' as const },
      { label: 'Total investido geral', value: formatCurrency(report.totalInvestidoGeral), tone: 'highlight' as const },
      { label: 'Lucro considerado', value: formatCurrency(report.lucroConsiderado), tone: report.lucroConsiderado >= 0 ? 'positive' as const : 'default' as const },
      { label: 'Valor final de saída', value: formatCurrency(report.valorSaida), tone: 'highlight' as const },
      { label: 'Rentabilidade simples', value: formatPercent(report.rentabilidadeSimples), tone: 'positive' as const },
      { label: 'TIR anual', value: formatPercent(report.tirAnual), tone: 'highlight' as const },
      { label: 'Taxa equivalente total do período', value: formatPercent(report.taxaEquivalentePeriodo), tone: 'accent' as const },
    ];

    let localY = y;
    cards.forEach((card, index) => {
      if (index % cols === 0) {
        ensureSpace(cardHeight + 4);
      }

      const x = marginX + (index % cols) * (cardWidth + gap);
      drawMetricCard(x, localY, cardWidth, cardHeight, card.label, card.value, card.tone);

      if (index % cols === cols - 1) {
        localY += cardHeight + gap;
      }
    });

    if (cards.length % cols !== 0) {
      localY += cardHeight + gap;
    }

    y = localY + 2;
  };

  const drawExecutiveSummary = () => {
    drawSectionTitle('Leitura executiva', 'Resumo Executivo');
    setFill(doc, COLORS.light);
    setDraw(doc, COLORS.border);

    const lineHeights = summarySentences.map((sentence) => doc.splitTextToSize(`• ${sentence}`, contentWidth - 10).length * 5.1);
    const blockHeight = lineHeights.reduce((sum, item) => sum + item, 10);
    ensureSpace(blockHeight + 4);
    doc.roundedRect(marginX, y, contentWidth, blockHeight, 3, 3, 'FD');

    let textY = y + 7;
    summarySentences.forEach((sentence) => {
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.2);
      const lines = doc.splitTextToSize(`• ${sentence}`, contentWidth - 10);
      doc.text(lines, marginX + 5, textY);
      textY += lines.length * 5.1;
    });

    y += blockHeight + 6;
  };

  const drawFlowTypeBadge = (label: string, x: number, badgeY: number, type: string) => {
    const palette = type === 'real_aporte'
      ? { bg: COLORS.blueSoft, text: COLORS.blue }
      : type === 'future_aporte'
        ? { bg: COLORS.goldSoft, text: COLORS.gold }
        : { bg: COLORS.greenSoft, text: COLORS.green };
    const width = Math.min(24, Math.max(18, doc.getTextWidth(label) + 6));

    setFill(doc, palette.bg);
    doc.roundedRect(x, badgeY, width, 5.2, 2, 2, 'F');
    setText(doc, palette.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(label, x + width / 2, badgeY + 3.4, { align: 'center' });
  };

  const drawFlowsTable = () => {
    drawSectionTitle('Detalhamento', 'Tabela de Fluxos');

    const columns = [
      { key: 'date', label: 'Data', width: 18, align: 'center' as const },
      { key: 'type', label: 'Tipo', width: 28, align: 'left' as const },
      { key: 'member', label: 'Membro', width: 35, align: 'left' as const },
      { key: 'participation', label: 'Participação', width: 21, align: 'right' as const },
      { key: 'amount', label: 'Valor', width: 24, align: 'right' as const },
      { key: 'days', label: 'Dias', width: 13, align: 'right' as const },
      { key: 'observation', label: 'Observação', width: 35, align: 'left' as const },
    ];

    const colX: number[] = [];
    let runningX = marginX;
    columns.forEach((column) => {
      colX.push(runningX);
      runningX += column.width;
    });

    const drawTableHeader = () => {
      ensureSpace(10);
      setFill(doc, COLORS.navy);
      doc.rect(marginX, y, contentWidth, 8, 'F');
      setText(doc, COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);

      columns.forEach((column, index) => {
        const headerX = colX[index] + (column.align === 'right' ? column.width - 2 : column.align === 'center' ? column.width / 2 : 2);
        doc.text(column.label, headerX, y + 5, {
          align: column.align === 'right' ? 'right' : column.align === 'center' ? 'center' : 'left',
        });
      });

      y += 8;
    };

    drawTableHeader();

    report.flows.forEach((flow, index) => {
      const observationLines = doc.splitTextToSize(flow.observation || '-', columns[6].width - 4);
      const memberLines = doc.splitTextToSize(flow.memberName || '-', columns[2].width - 4);
      const rowHeight = Math.max(9, Math.max(observationLines.length, memberLines.length) * 4.4 + 4.5);

      if (y + rowHeight > pageHeight - bottomReserve) {
        addPage();
        drawTableHeader();
      }

      const rowFill = flow.type === 'exit'
        ? COLORS.greenSoft
        : index % 2 === 0
          ? COLORS.light
          : COLORS.white;

      setFill(doc, rowFill);
      doc.rect(marginX, y, contentWidth, rowHeight, 'F');
      setDraw(doc, COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(marginX, y + rowHeight, pageWidth - marginX, y + rowHeight);

      const textY = y + 5.2;
      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', flow.type === 'exit' ? 'bold' : 'normal');
      doc.setFontSize(8.4);

      doc.text(formatDateForDisplay(flow.date), colX[0] + columns[0].width / 2, textY, { align: 'center' });
      drawFlowTypeBadge(flow.typeLabel, colX[1] + 2, y + 2.2, flow.type);

      doc.text(memberLines, colX[2] + 2, textY);
      doc.text(
        flow.participationPercentage === null ? '-' : formatPercent(flow.participationPercentage / 100),
        colX[3] + columns[3].width - 2,
        textY,
        { align: 'right' },
      );

      setText(doc, flow.type === 'exit' ? COLORS.green : COLORS.graphite);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(flow.amount), colX[4] + columns[4].width - 2, textY, { align: 'right' });

      setText(doc, COLORS.graphite);
      doc.setFont('helvetica', flow.type === 'exit' ? 'bold' : 'normal');
      doc.text(String(flow.daysToExit), colX[5] + columns[5].width - 2, textY, { align: 'right' });
      doc.text(observationLines, colX[6] + 2, textY);

      y += rowHeight;
    });

    y += 6;
  };

  const drawMethodology = () => {
    drawSectionTitle('Critérios', 'Metodologia do Cálculo');

    const items = [
      'Rentabilidade simples = lucro considerado / total investido geral.',
      'TIR anual = taxa que equaliza financeiramente os fluxos de caixa no tempo.',
      'Taxa equivalente total do período = conversão da taxa anual para o prazo total da operação.',
      'Aportes futuros simulados, quando existentes, são incluídos como fluxos projetados.',
    ];

    const gap = 4;
    const colWidth = (contentWidth - gap) / 2;
    const heights = items.map((item) => {
      const lines = doc.splitTextToSize(item, colWidth - 10);
      return Math.max(16, 9 + lines.length * 4.4);
    });

    let localY = y;
    items.forEach((item, index) => {
      if (index % 2 === 0) {
        ensureSpace(Math.max(heights[index], heights[index + 1] ?? 0) + 4);
      }

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

      if (index % 2 === 1) {
        localY += Math.max(heights[index], heights[index - 1]) + gap;
      }
    });

    if (items.length % 2 !== 0) {
      localY += heights[heights.length - 1] + gap;
    }

    y = localY;
  };

  drawHeader();
  drawInfoBlock();
  drawIndicatorCards();
  drawExecutiveSummary();
  drawFlowsTable();
  drawMethodology();

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
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

  const filename = `rentabilidade_projeto_${sanitizeFilenamePart(report.projectName)}_${report.exitDate}.pdf`;
  doc.save(filename);
}
