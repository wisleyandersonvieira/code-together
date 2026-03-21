import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

import type { ProfitabilityReportResult } from '@/utils/project-profitability';
import { formatDateForDisplay } from '@/utils/timezone';

type ExportContext = {
  formatCurrency: (value: number) => string;
  formatPercent: (value: number | null | undefined) => string;
};

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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let y = 16;

  const ensureSpace = (heightNeeded: number) => {
    if (y + heightNeeded <= pageHeight - 16) {
      return;
    }

    doc.addPage();
    y = 16;
  };

  const drawHeader = () => {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PROVISION', 14, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Relatorio de Rentabilidade do Projeto', 14, y);
    y += 8;
  };

  drawHeader();

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text(report.projectName, 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  const headerLines = [
    `Visualizacao: ${report.viewType === 'project_total' ? 'Projeto total' : 'Por membros'}`,
    `Membros: ${report.selectedMemberNames.join(', ') || '-'}`,
    `Data final de saida: ${formatDateForDisplay(report.exitDate)}`,
    `Lucro liquido informado: ${formatCurrency(report.lucroLiquidoInformado)}`,
    `Lucro considerado: ${formatCurrency(report.lucroConsiderado)}`,
    `Percentual total considerado: ${report.percentualTotalConsiderado === null ? '-' : formatPercent(report.percentualTotalConsiderado / 100)}`,
  ];
  headerLines.forEach((line) => {
    doc.text(line, 14, y);
    y += 5;
  });

  y += 2;
  doc.setFont(undefined, 'bold');
  doc.text('Resumo', 14, y);
  y += 6;

  const summaryRows = [
    ['Total investido real', formatCurrency(report.totalInvestidoReal)],
    ['Aportes futuros simulados', formatCurrency(report.totalAportesFuturos)],
    ['Total investido geral', formatCurrency(report.totalInvestidoGeral)],
    ['Lucro considerado', formatCurrency(report.lucroConsiderado)],
    ['Valor final de saida', formatCurrency(report.valorSaida)],
    ['Rentabilidade simples', formatPercent(report.rentabilidadeSimples)],
    ['TIR anual', formatPercent(report.tirAnual)],
    ['Taxa equivalente total do periodo', formatPercent(report.taxaEquivalentePeriodo)],
  ];

  summaryRows.forEach(([label, value], index) => {
    const rowY = y + index * 6;
    doc.setFillColor(index % 2 === 0 ? 245 : 255, index % 2 === 0 ? 247 : 255, index % 2 === 0 ? 250 : 255);
    doc.rect(14, rowY - 4, pageWidth - 28, 6, 'F');
    doc.setFont(undefined, 'normal');
    doc.text(label, 16, rowY);
    doc.setFont(undefined, 'bold');
    doc.text(String(value), pageWidth - 16, rowY, { align: 'right' });
  });
  y += summaryRows.length * 6 + 6;

  ensureSpace(16);
  doc.setFont(undefined, 'bold');
  doc.text('Fluxos utilizados no calculo', 14, y);
  y += 6;

  const tableHeaders = ['Data', 'Tipo', 'Membro', '%', 'Valor', 'Dias', 'Obs.'];
  const columnX = [14, 34, 58, 120, 136, 163, 176];
  const columnWidths = [18, 22, 60, 16, 24, 12, 20];

  const drawTableHeader = () => {
    doc.setFillColor(52, 73, 94);
    doc.rect(14, y - 4, pageWidth - 28, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    tableHeaders.forEach((header, index) => {
      doc.text(header, columnX[index], y);
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    y += 7;
  };

  drawTableHeader();

  report.flows.forEach((flow, index) => {
    ensureSpace(8);
    if (y >= pageHeight - 20) {
      drawTableHeader();
    }

    doc.setFillColor(index % 2 === 0 ? 249 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 251 : 255);
    doc.rect(14, y - 4, pageWidth - 28, 7, 'F');

    const values = [
      formatDateForDisplay(flow.date),
      flow.typeLabel,
      flow.memberName || '-',
      flow.participationPercentage === null ? '-' : formatPercent(flow.participationPercentage / 100),
      formatCurrency(flow.amount),
      String(flow.daysToExit),
      (flow.observation || '-').slice(0, 18),
    ];

    values.forEach((value, indexValue) => {
      const text = String(value);
      const maxWidth = columnWidths[indexValue];
      doc.text(text.length > 28 ? `${text.slice(0, 25)}...` : text, columnX[indexValue], y, {
        maxWidth,
      });
    });

    y += 7;
  });

  ensureSpace(22);
  y += 4;
  doc.setFont(undefined, 'bold');
  doc.text('Notas', 14, y);
  y += 6;
  doc.setFont(undefined, 'normal');
  [
    'Rentabilidade simples = lucro considerado / total investido geral.',
    'TIR anual = taxa anual que zera o valor presente liquido dos fluxos.',
    'Taxa equivalente total = conversao da TIR anual para o prazo total da operacao.',
    'Aportes futuros simulados foram incluidos como fluxos projetados.',
  ].forEach((line) => {
    doc.text(line, 14, y);
    y += 5;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Pagina ${page} de ${pages}`, pageWidth - 24, pageHeight - 8, { align: 'right' });
    doc.text('PROVISION - Sistema de Gestao Financeira', 14, pageHeight - 8);
  }

  const filename = `rentabilidade_projeto_${report.projectName.replace(/[^a-zA-Z0-9]+/g, '_')}_${report.exitDate}.pdf`;
  doc.save(filename);
}
