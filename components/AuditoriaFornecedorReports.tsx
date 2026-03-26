'use client';

import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { BarChart3, FileDown, X } from 'lucide-react';
import jsPDF from 'jspdf';

import loadAuditoriaFornecedoresReportAction from '@/actions/loadAuditoriaFornecedoresReport';
import loadAuditoriasFornecedoresAction from '@/actions/loadAuditoriasFornecedores';
import loadFornecedoresSubcontratadosAction from '@/actions/loadFornecedoresSubcontratados';
import loadProjetosAction from '@/actions/loadProjetos';
import { ListingEmptyState, ListingFilterCard, ListingPageHeader, ListingTableCard, listingSecondaryButtonClassName, listingTableCellClassName, listingTableHeadClassName } from '@/components/finance/listing-ui';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, formatDateForDisplay } from '@/utils/timezone';

type ReportStatus = 'all' | 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA';

interface ReportRow {
  projeto_nome: string;
  fornecedor_nome: string;
  total_auditorias: number;
  total_itens: number;
  valor_total: number;
  valor_pago: number;
  valor_a_pagar: number;
}

interface OptionRow {
  id: number;
  nome_razao_social?: string;
  name?: string;
  data_auditoria?: string;
}

type RgbColor = [number, number, number];

const C = {
  navy: [17, 31, 59] as RgbColor,
  navySoft: [229, 236, 246] as RgbColor,
  graphite: [59, 68, 82] as RgbColor,
  slate: [107, 114, 128] as RgbColor,
  border: [217, 223, 232] as RgbColor,
  light: [245, 247, 250] as RgbColor,
  white: [255, 255, 255] as RgbColor,
  green: [22, 101, 52] as RgbColor,
  greenSoft: [236, 253, 245] as RgbColor,
  rose: [190, 24, 93] as RgbColor,
  roseSoft: [255, 241, 242] as RgbColor,
  gold: [146, 103, 33] as RgbColor,
  goldSoft: [255, 251, 235] as RgbColor,
} as const;

function exportAuditoriaPDF(
  rows: ReportRow[],
  totals: { valor_total: number; valor_pago: number; valor_a_pagar: number; auditorias: number },
  filters: { dataInicial?: Date; dataFinal?: Date; status: ReportStatus; auditoriaLabel?: string; fornecedorLabel?: string; projetoLabel?: string },
  formatCurrency: (v: number) => string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  let y = 0;

  const sf = (c: RgbColor) => doc.setFillColor(c[0], c[1], c[2]);
  const sd = (c: RgbColor) => doc.setDrawColor(c[0], c[1], c[2]);
  const st = (c: RgbColor) => doc.setTextColor(c[0], c[1], c[2]);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      doc.addPage();
      y = 14;
    }
  };

  const fmtDate = (d?: Date) =>
    d
      ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
      : '–';

  // Header bar
  sf(C.navy);
  doc.rect(0, 0, pageWidth, 22, 'F');
  st(C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('AUDITORIA DE FORNECEDORES', marginX, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Relatório Consolidado', marginX, 16);
  const now = new Date();
  const nowStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(now);
  doc.text(`Gerado em ${nowStr}`, pageWidth - marginX, 16, { align: 'right' });

  y = 30;

  // Section: filters info
  const drawSectionTitle = (title: string) => {
    ensureSpace(14);
    st(C.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, marginX, y);
    y += 3.5;
    sd(C.border);
    doc.setLineWidth(0.35);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  };

  drawSectionTitle('Filtros Aplicados');

  const filterPairs: [string, string][] = [
    ['Período', filters.dataInicial || filters.dataFinal ? `${fmtDate(filters.dataInicial)} – ${fmtDate(filters.dataFinal)}` : 'Todos'],
    ['Status', filters.status === 'all' ? 'Todos' : filters.status === 'ABERTA' ? 'Aberta' : filters.status === 'PARCIALMENTE_PAGA' ? 'Parcialmente paga' : 'Quitada'],
    ['Auditoria', filters.auditoriaLabel || 'Todas'],
    ['Fornecedor', filters.fornecedorLabel || 'Todos'],
    ['Projeto', filters.projetoLabel || 'Todos'],
  ];
  const colW = (pageWidth - marginX * 2) / filterPairs.length;
  filterPairs.forEach(([label, val], i) => {
    const x = marginX + i * colW;
    sf(C.light);
    doc.roundedRect(x, y, colW - 2, 14, 2, 2, 'F');
    st(C.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 4, y + 5);
    st(C.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(val, colW - 8);
    doc.text(lines[0], x + 4, y + 11);
  });
  y += 20;

  // Indicator cards
  drawSectionTitle('Resumo');

  const cards = [
    { label: 'Auditorias somadas', value: String(totals.auditorias), color: C.navy },
    { label: 'Valor Total', value: formatCurrency(totals.valor_total), color: C.navy },
    { label: 'Pago', value: formatCurrency(totals.valor_pago), color: C.green },
    { label: 'A Pagar', value: formatCurrency(totals.valor_a_pagar), color: totals.valor_a_pagar > 0 ? C.rose : C.navy },
  ];
  const cardW = (pageWidth - marginX * 2) / cards.length;
  cards.forEach((card, i) => {
    const x = marginX + i * cardW;
    sf(C.light);
    doc.roundedRect(x, y, cardW - 2, 18, 2, 2, 'F');
    st(C.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(card.label.toUpperCase(), x + 4, y + 6);
    st(card.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(card.value, x + 4, y + 14);
  });
  y += 24;

  // Main table
  drawSectionTitle('Detalhamento por Projeto e Fornecedor');

  const cols = [
    { label: 'Projeto', width: 60 },
    { label: 'Fornecedor', width: 65 },
    { label: 'Auditorias', width: 22 },
    { label: 'Itens', width: 16 },
    { label: 'Valor Total', width: 36 },
    { label: 'Pago', width: 36 },
    { label: 'A Pagar', width: 36 },
  ];
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  const tableStartX = marginX;

  // Header row
  ensureSpace(8);
  sf(C.navy);
  doc.rect(tableStartX, y, tableWidth, 8, 'F');
  let cx = tableStartX;
  cols.forEach((col) => {
    st(C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(col.label, cx + 3, y + 5.5);
    cx += col.width;
  });
  y += 8;

  // Data rows
  rows.forEach((row, idx) => {
    ensureSpace(8);
    const rowBg = idx % 2 === 0 ? C.white : C.light;
    sf(rowBg);
    doc.rect(tableStartX, y, tableWidth, 8, 'F');

    cx = tableStartX;
    const cells = [
      row.projeto_nome,
      row.fornecedor_nome,
      String(row.total_auditorias),
      String(row.total_itens),
      formatCurrency(row.valor_total),
      formatCurrency(row.valor_pago),
      formatCurrency(row.valor_a_pagar),
    ];
    cells.forEach((text, ci) => {
      const col = cols[ci];
      if (ci >= 4) {
        st(ci === 5 ? C.green : C.graphite);
      } else {
        st(C.graphite);
      }
      doc.setFont(ci === 0 ? 'helvetica' : 'helvetica', ci === 0 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      const fitted = doc.splitTextToSize(text, col.width - 5);
      doc.text(fitted[0], cx + 3, y + 5.5);
      cx += col.width;
    });

    sd(C.border);
    doc.setLineWidth(0.1);
    doc.line(tableStartX, y + 8, tableStartX + tableWidth, y + 8);
    y += 8;
  });

  // Total row
  ensureSpace(9);
  sf(C.navySoft);
  doc.rect(tableStartX, y, tableWidth, 9, 'F');
  cx = tableStartX;
  const totalCells = ['TOTAL GERAL', '', String(totals.auditorias), '', formatCurrency(totals.valor_total), formatCurrency(totals.valor_pago), formatCurrency(totals.valor_a_pagar)];
  totalCells.forEach((text, ci) => {
    st(ci === 5 ? C.green : C.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(text, cx + 3, y + 6);
    cx += cols[ci].width;
  });
  y += 9;

  // Footer
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    sf(C.light);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    st(C.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Relatório gerado automaticamente — Provision', marginX, pageHeight - 3);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 3, { align: 'right' });
  }

  doc.save('auditoria-fornecedores-relatorio.pdf');
}

export function AuditoriaFornecedorReports() {
  const { formatCurrency } = useCurrency();
  const [dataInicial, setDataInicial] = useState<Date | undefined>();
  const [dataFinal, setDataFinal] = useState<Date | undefined>();
  const [fornecedorId, setFornecedorId] = useState('all');
  const [projetoId, setProjetoId] = useState('all');
  const [auditoriaId, setAuditoriaId] = useState('all');
  const [status, setStatus] = useState<ReportStatus>('all');

  const [rows, loading, error] = useLoadAction(loadAuditoriaFornecedoresReportAction, [], {
    dataInicial: dataInicial ? formatDateForDatabase(dataInicial) : null,
    dataFinal: dataFinal ? formatDateForDatabase(dataFinal) : null,
    fornecedorId: fornecedorId !== 'all' ? Number(fornecedorId) : null,
    projetoId: projetoId !== 'all' ? Number(projetoId) : null,
    auditoriaId: auditoriaId !== 'all' ? Number(auditoriaId) : null,
    status,
  });
  const [suppliers] = useLoadAction(loadFornecedoresSubcontratadosAction, [], { status: 'all' });
  const [projects] = useLoadAction(loadProjetosAction, []);
  const [auditorias] = useLoadAction(loadAuditoriasFornecedoresAction, []);

  const totals = useMemo(
    () =>
      (rows || []).reduce(
        (acc: { valor_total: number; valor_pago: number; valor_a_pagar: number; auditorias: number }, row: ReportRow) => ({
          valor_total: acc.valor_total + Number(row.valor_total || 0),
          valor_pago: acc.valor_pago + Number(row.valor_pago || 0),
          valor_a_pagar: acc.valor_a_pagar + Number(row.valor_a_pagar || 0),
          auditorias: acc.auditorias + Number(row.total_auditorias || 0),
        }),
        { valor_total: 0, valor_pago: 0, valor_a_pagar: 0, auditorias: 0 },
      ),
    [rows],
  );

  const supplierOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...(suppliers || []).map((s: OptionRow) => ({ value: String(s.id), label: s.nome_razao_social || '' }))],
    [suppliers],
  );

  const projectOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...(projects || []).map((p: OptionRow) => ({ value: String(p.id), label: p.name || '' }))],
    [projects],
  );

  const auditoriaOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas' },
      ...(auditorias || []).map((a: OptionRow) => ({
        value: String(a.id),
        label: `#${a.id}${a.data_auditoria ? ` — ${formatDateForDisplay(a.data_auditoria)}` : ''}`,
      })),
    ],
    [auditorias],
  );

  const handleExportPDF = () => {
    const fornecedorLabel = supplierOptions.find((o) => o.value === fornecedorId)?.label;
    const projetoLabel = projectOptions.find((o) => o.value === projetoId)?.label;
    const auditoriaLabel = auditoriaOptions.find((o) => o.value === auditoriaId)?.label;
    exportAuditoriaPDF(
      rows || [],
      totals,
      {
        dataInicial,
        dataFinal,
        status,
        auditoriaLabel: auditoriaId !== 'all' ? auditoriaLabel : undefined,
        fornecedorLabel: fornecedorId !== 'all' ? fornecedorLabel : undefined,
        projetoLabel: projetoId !== 'all' ? projetoLabel : undefined,
      },
      formatCurrency,
    );
  };

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Auditoria > Relatórios"
        description="Visão consolidada por projeto e fornecedor para acompanhar passivos, pagamentos e exposição."
      />

      <ListingFilterCard>
        <div className="grid gap-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_200px]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data inicial</label>
            <DatePickerWithYearSelector date={dataInicial} onDateChange={setDataInicial} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data final</label>
            <DatePickerWithYearSelector date={dataFinal} onDateChange={setDataFinal} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Auditoria</label>
            <Combobox value={auditoriaId} onValueChange={setAuditoriaId} options={auditoriaOptions} placeholder="Todas" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Fornecedor</label>
            <Combobox value={fornecedorId} onValueChange={setFornecedorId} options={supplierOptions} placeholder="Todos" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Projeto</label>
            <Combobox value={projetoId} onValueChange={setProjetoId} options={projectOptions} placeholder="Todos" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm" value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)}>
              <option value="all">Todos</option>
              <option value="ABERTA">Aberta</option>
              <option value="PARCIALMENTE_PAGA">Parcialmente paga</option>
              <option value="QUITADA">Quitada</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button
            type="button"
            className={listingSecondaryButtonClassName}
            onClick={() => {
              setDataInicial(undefined);
              setDataFinal(undefined);
              setFornecedorId('all');
              setProjetoId('all');
              setAuditoriaId('all');
              setStatus('all');
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
          <Button
            type="button"
            className={listingSecondaryButtonClassName}
            disabled={loading || (rows || []).length === 0}
            onClick={handleExportPDF}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </ListingFilterCard>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Auditorias somadas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.auditorias}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.valor_total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pago</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(totals.valor_pago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">A pagar</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.valor_a_pagar)}</p>
          </CardContent>
        </Card>
      </div>

      <ListingTableCard>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando relatório...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-600">Erro ao carregar relatório.</div>
          ) : (rows || []).length === 0 ? (
            <ListingEmptyState icon={BarChart3} title="Sem dados para o relatório" description="Ajuste os filtros ou cadastre auditorias para visualizar consolidados." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>Projeto</TableHead>
                    <TableHead className={listingTableHeadClassName}>Fornecedor</TableHead>
                    <TableHead className={listingTableHeadClassName}>Auditorias</TableHead>
                    <TableHead className={listingTableHeadClassName}>Itens</TableHead>
                    <TableHead className={listingTableHeadClassName}>Valor total</TableHead>
                    <TableHead className={listingTableHeadClassName}>Pago</TableHead>
                    <TableHead className={listingTableHeadClassName}>A pagar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows || []).map((row: ReportRow, index: number) => (
                    <TableRow key={`${row.projeto_nome}-${row.fornecedor_nome}-${index}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{row.projeto_nome}</TableCell>
                      <TableCell className={listingTableCellClassName}>{row.fornecedor_nome}</TableCell>
                      <TableCell className={listingTableCellClassName}>{row.total_auditorias}</TableCell>
                      <TableCell className={listingTableCellClassName}>{row.total_itens}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatCurrency(row.valor_total)}</TableCell>
                      <TableCell className={`${listingTableCellClassName} text-emerald-600`}>{formatCurrency(row.valor_pago)}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatCurrency(row.valor_a_pagar)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </ListingTableCard>
    </div>
  );
}
