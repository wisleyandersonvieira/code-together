'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import loadRetiradasAction from '@/actions/loadRetiradas';
import deleteRetiradaAction from '@/actions/deleteRetirada';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import { RetiradaForm } from './RetiradaForm';
import { Plus, Edit, Trash2, Filter, X, FileSpreadsheet, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

/** Converte Date → "YYYY-MM-DD" sem problemas de fuso horário */
function toDBDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Exibe data no formato dd/mm/yyyy a partir de "YYYY-MM-DD" ou ISO */
function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '-';
  const s = raw.split('T')[0];
  const p = s.split('-');
  if (p.length !== 3) return '-';
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RetiradasList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [showForm, setShowForm] = useState(false);
  const [editingRetirada, setEditingRetirada] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros temporários (antes de aplicar)
  const [tempFilters, setTempFilters] = useState({
    dataInicio: undefined as Date | undefined,
    dataFim: undefined as Date | undefined,
    matrizId: 'all',
    socioId: 'all',
    contaId: 'all',
  });

  // Filtros aplicados (enviados ao backend)
  const [appliedFilters, setAppliedFilters] = useState({
    dataInicio: undefined as Date | undefined,
    dataFim: undefined as Date | undefined,
    matrizId: 'all',
    socioId: 'all',
    contaId: 'all',
  });

  const actionFilters = useMemo(() => ({
    dataInicio: appliedFilters.dataInicio ? toDBDate(appliedFilters.dataInicio) : null,
    dataFim:    appliedFilters.dataFim    ? toDBDate(appliedFilters.dataFim)    : null,
    matrizId:   appliedFilters.matrizId !== 'all' ? appliedFilters.matrizId : null,
    socioId:    appliedFilters.socioId  !== 'all' ? appliedFilters.socioId  : null,
    contaId:    appliedFilters.contaId  !== 'all' ? appliedFilters.contaId  : null,
  }), [appliedFilters]);

  const [retiradas, loadingRetiradas, , refreshRetiradas] = useLoadAction(loadRetiradasAction, [], actionFilters);
  const [socios]  = useLoadAction(loadSociosAction,  [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas]  = useLoadAction(loadContasAction, []);
  const [deleteRetirada, isDeleting] = useMutateAction(deleteRetiradaAction);

  // ── Totais: sempre sobre TODOS os registros filtrados ──────────────────────
  const totalValor = useMemo(
    () => (retiradas as any[]).reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0),
    [retiradas],
  );
  const totalQuantidade = (retiradas as any[]).length;

  // ── Paginação client-side ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalQuantidade / PAGE_SIZE));
  const retiradasPagina = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return (retiradas as any[]).slice(start, start + PAGE_SIZE);
  }, [retiradas, currentPage]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEdit = (retirada: any) => { setEditingRetirada(retirada); setShowForm(true); };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta retirada?')) return;
    try {
      await deleteRetirada({ id });
      toast({ title: 'Sucesso', description: 'Retirada excluída com sucesso!' });
      refreshRetiradas();
    } catch {
      toast({ title: 'Erro', description: 'Erro ao excluir retirada.', variant: 'destructive' });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingRetirada(null);
    setTimeout(() => refreshRetiradas(), 100);
  };

  const applyFilters = () => {
    setAppliedFilters({ ...tempFilters });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    const empty = { dataInicio: undefined, dataFim: undefined, matrizId: 'all', socioId: 'all', contaId: 'all' };
    setTempFilters(empty);
    setAppliedFilters(empty);
    setCurrentPage(1);
  };

  const handlePageChange = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  // ── Período formatado (para exports) ──────────────────────────────────────
  const periodoLabel = appliedFilters.dataInicio && appliedFilters.dataFim
    ? `${fmtDate(toDBDate(appliedFilters.dataInicio))} a ${fmtDate(toDBDate(appliedFilters.dataFim))}`
    : 'Todos os períodos';

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT EXCEL
  // ─────────────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!(retiradas as any[]).length) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }
    try {
      const rows = (retiradas as any[]).map((r) => ({
        Data:        fmtDate(r.data_retirada),
        'Sócio':     r.socio_nome  || '-',
        'Matriz':    r.matriz_nome || '-',
        'Conta':     r.conta_nome  || '-',
        'Valor':     parseFloat(r.valor) || 0,
        'Observações': r.observacoes || '-',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, [
        ['Relatório de Retiradas'],
        [''],
        ['Período:', periodoLabel],
        ['Total:', formatCurrency(totalValor)],
        ['Quantidade:', totalQuantidade],
        [''],
        ['Data', 'Sócio', 'Matriz', 'Conta', 'Valor', 'Observações'],
      ]);
      XLSX.utils.sheet_add_json(ws, rows, { origin: 'A8', skipHeader: true });
      ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Retiradas');
      XLSX.writeFile(wb, `Retiradas_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Sucesso', description: 'Relatório exportado para Excel com sucesso!' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao exportar para Excel.', variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT PDF — novo layout moderno
  // ─────────────────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const allRows = retiradas as any[];
    if (!allRows.length) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
      const PW   = doc.internal.pageSize.getWidth();   // 210
      const PH   = doc.internal.pageSize.getHeight();  // 297
      const MX   = 14;  // margem horizontal
      const CW   = PW - MX * 2; // largura do conteúdo = 182

      // ── Paleta de cores ──────────────────────────────────────────────────
      type RGB = [number, number, number];
      const C: Record<string, RGB> = {
        headerBg:    [30,  41,  59],   // slate-800
        accent:      [99,  102, 241],  // indigo-500
        tableHead:   [30,  41,  59],   // slate-800
        groupBg:     [238, 242, 255],  // indigo-50
        groupText:   [67,  56,  202],  // indigo-700
        subtotalBg:  [224, 231, 255],  // indigo-100
        totalBg:     [30,  41,  59],   // slate-800
        rowEven:     [248, 250, 252],  // slate-50
        rowOdd:      [241, 245, 249],  // slate-100
        border:      [226, 232, 240],  // slate-200
        text:        [15,  23,  42],   // slate-900
        textSec:     [100, 116, 139],  // slate-500
        white:       [255, 255, 255],
        danger:      [220, 38,  38],   // red-600
        dangerLight: [254, 242, 242],  // red-50
      };

      // ── Metadados ────────────────────────────────────────────────────────
      const emissao = new Date().toLocaleDateString('pt-BR') +
        ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Filtros aplicados para exibir no PDF
      const filtrosDesc: string[] = [];
      if (appliedFilters.dataInicio && appliedFilters.dataFim) filtrosDesc.push(`Período: ${periodoLabel}`);
      const socioSel = (socios as any[]).find(s => s.id.toString() === appliedFilters.socioId);
      if (socioSel) filtrosDesc.push(`Sócio: ${socioSel.nome}`);
      const matrizSel = (matrizes as any[]).find(m => m.id.toString() === appliedFilters.matrizId);
      if (matrizSel) filtrosDesc.push(`Matriz: ${matrizSel.nome}`);
      const contaSel = (contas as any[]).find(c => c.id.toString() === appliedFilters.contaId);
      if (contaSel) filtrosDesc.push(`Conta: ${contaSel.nome}`);
      if (!filtrosDesc.length) filtrosDesc.push('Sem filtros aplicados');

      // ── Definição de colunas da tabela ───────────────────────────────────
      // x = posição absoluta, w = largura em mm
      const COLS = [
        { x: MX,      w: 22, label: 'Data',    align: 'left'  as const },
        { x: MX + 22, w: 40, label: 'Sócio',   align: 'left'  as const },
        { x: MX + 62, w: 38, label: 'Matriz',  align: 'left'  as const },
        { x: MX + 100,w: 34, label: 'Conta',   align: 'left'  as const },
        { x: MX + 134,w: 28, label: 'Valor',   align: 'right' as const },
        { x: MX + 162,w: 20, label: 'Obs.',    align: 'left'  as const },
      ];
      // Total: 22+40+38+34+28+20 = 182 = CW ✓

      const LINE_H = 6;
      let pageNum = 1;
      let yPos    = 0;

      // ── Cabeçalho de página ──────────────────────────────────────────────
      const drawPageHeader = (isFirst: boolean) => {
        const barH = isFirst ? 52 : 30;
        doc.setFillColor(...C.headerBg);
        doc.rect(0, 0, PW, barH, 'F');
        // Barra accent lateral
        doc.setFillColor(...C.accent);
        doc.rect(0, 0, 5, barH, 'F');

        doc.setTextColor(...C.white);
        if (isFirst) {
          doc.setFontSize(20); doc.setFont('helvetica', 'bold');
          doc.text('PROVISION', MX + 5, 18);
          doc.setFontSize(13); doc.setFont('helvetica', 'normal');
          doc.text('Relatório de Retiradas', MX + 5, 30);
          doc.setFontSize(8);
          doc.text(`Período: ${periodoLabel}`, PW - MX, 20, { align: 'right' });
          doc.text(`Emitido: ${emissao}`,      PW - MX, 28, { align: 'right' });
          // linha de filtros
          doc.setFontSize(7.5);
          doc.setTextColor(200, 210, 255);
          const filtrosTxt = filtrosDesc.join('  |  ');
          doc.text(filtrosTxt, MX + 5, 42, { maxWidth: CW - 10 });
          yPos = barH + 6;
        } else {
          doc.setFontSize(11); doc.setFont('helvetica', 'bold');
          doc.text('PROVISION', MX + 5, 13);
          doc.setFontSize(9); doc.setFont('helvetica', 'normal');
          doc.text('Relatório de Retiradas', MX + 5, 21);
          doc.setFontSize(8);
          doc.text(`Período: ${periodoLabel}`, PW - MX, 15, { align: 'right' });
          yPos = barH + 4;
        }
        doc.setTextColor(...C.text);
      };

      // ── Rodapé de página (desenhado no final, após saber total de páginas) ─
      const footers: Array<{ page: number; num: number }> = [];
      const drawFooter = (pageN: number, totalP: number) => {
        const fy = PH - 12;
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(MX, fy - 4, PW - MX, fy - 4);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.textSec);
        doc.text('PROVISION',                   MX,       fy);
        doc.text(emissao,                        PW / 2,   fy, { align: 'center' });
        doc.text(`Página ${pageN} de ${totalP}`, PW - MX,  fy, { align: 'right' });
        doc.setTextColor(...C.text);
      };

      // ── Cabeçalho da tabela ──────────────────────────────────────────────
      const drawTableHeader = () => {
        doc.setFillColor(...C.tableHead);
        doc.rect(MX, yPos - 5, CW, 7, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.white);
        COLS.forEach(col => {
          if (col.align === 'right') {
            doc.text(col.label, col.x + col.w - 2, yPos, { align: 'right' });
          } else {
            doc.text(col.label, col.x + 2, yPos);
          }
        });
        doc.setTextColor(...C.text);
        yPos += 4;
      };

      // ── Verificação de quebra de página ──────────────────────────────────
      const checkPageBreak = (neededH = LINE_H + 2) => {
        if (yPos + neededH > PH - 20) {
          footers.push({ page: pageNum, num: pageNum });
          doc.addPage();
          pageNum++;
          drawPageHeader(false);
          drawTableHeader();
        }
      };

      // ── Renderiza uma linha da tabela ────────────────────────────────────
      let rowIdx = 0;
      const drawRow = (r: any) => {
        checkPageBreak();
        doc.setFillColor(...(rowIdx % 2 === 0 ? C.rowEven : C.rowOdd));
        doc.rect(MX, yPos - 4, CW, LINE_H, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);

        const cells = [
          fmtDate(r.data_retirada),
          (r.socio_nome  || '-').substring(0, 22),
          (r.matriz_nome || '-').substring(0, 20),
          (r.conta_nome  || '-').substring(0, 17),
          formatCurrency(parseFloat(r.valor) || 0),
          (r.observacoes || '-').substring(0, 14),
        ];

        COLS.forEach((col, i) => {
          if (col.align === 'right') {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.danger);
            doc.text(cells[i], col.x + col.w - 2, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.text);
          } else {
            doc.text(cells[i], col.x + 2, yPos);
          }
        });

        yPos += LINE_H;
        rowIdx++;
      };

      // ── PÁGINA 1: cabeçalho ───────────────────────────────────────────────
      drawPageHeader(true);

      // ── Cards de resumo ──────────────────────────────────────────────────
      const cardW = (CW - 8) / 3;
      const cardY = yPos;
      const cardDefs = [
        { label: 'Total de Retiradas', value: formatCurrency(totalValor), color: C.danger },
        { label: 'Quantidade',         value: `${totalQuantidade} retirada${totalQuantidade !== 1 ? 's' : ''}`, color: C.text },
        { label: 'Período',            value: periodoLabel,                color: C.textSec },
      ];
      cardDefs.forEach((card, i) => {
        const cx = MX + i * (cardW + 4);
        doc.setFillColor(...C.rowEven);
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, cardY, cardW, 18, 2, 2, 'FD');
        // Label
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.textSec);
        doc.text(card.label, cx + 4, cardY + 7);
        // Value
        doc.setFontSize(i === 0 ? 9.5 : 8.5); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...card.color);
        doc.text(card.value, cx + 4, cardY + 14);
      });
      doc.setTextColor(...C.text);
      yPos = cardY + 26;

      // ── Cabeçalho inicial da tabela ──────────────────────────────────────
      drawTableHeader();

      // ── Agrupamento por sócio ────────────────────────────────────────────
      const grouped: Map<string, any[]> = new Map();
      allRows.forEach(r => {
        const key = r.socio_nome || 'Sem Sócio';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
      });

      grouped.forEach((socioRows, socioNome) => {
        // Cabeçalho do grupo
        checkPageBreak(LINE_H + 4);
        doc.setFillColor(...C.groupBg);
        doc.rect(MX, yPos - 4, CW, LINE_H + 0.5, 'F');
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.groupText);
        doc.text(`Sócio: ${socioNome}`, MX + 3, yPos);
        doc.setTextColor(...C.text);
        yPos += LINE_H;
        rowIdx = 0;

        // Linhas do sócio
        let socioTotal = 0;
        socioRows.forEach(r => {
          drawRow(r);
          socioTotal += parseFloat(r.valor) || 0;
        });

        // Subtotal do sócio
        checkPageBreak(LINE_H + 2);
        doc.setFillColor(...C.subtotalBg);
        doc.rect(MX, yPos - 4, CW, LINE_H + 1, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.groupText);
        doc.text(`Subtotal — ${socioNome}`, MX + 3, yPos);
        doc.setTextColor(...C.danger);
        doc.text(
          formatCurrency(socioTotal),
          COLS[4].x + COLS[4].w - 2,
          yPos,
          { align: 'right' },
        );
        doc.setTextColor(...C.text);
        yPos += LINE_H + 3;
      });

      // ── Total geral ──────────────────────────────────────────────────────
      checkPageBreak(10);
      doc.setFillColor(...C.totalBg);
      doc.rect(MX, yPos - 4, CW, 9, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(
        `TOTAL GERAL  (${totalQuantidade} retirada${totalQuantidade !== 1 ? 's' : ''})`,
        MX + 3,
        yPos + 1,
      );
      doc.text(
        formatCurrency(totalValor),
        COLS[4].x + COLS[4].w - 2,
        yPos + 1,
        { align: 'right' },
      );
      doc.setTextColor(...C.text);

      // ── Rodapés (agora que sabemos o total de páginas) ───────────────────
      const finalTotal = pageNum;
      // Rodapé da última página
      doc.setPage(pageNum);
      drawFooter(pageNum, finalTotal);
      // Rodapés das páginas anteriores
      footers.forEach(f => {
        doc.setPage(f.page);
        drawFooter(f.num, finalTotal);
      });

      doc.save(`Retiradas_${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Sucesso', description: 'Relatório exportado para PDF com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({ title: 'Erro', description: 'Falha ao exportar o relatório para PDF.', variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (showForm) {
    return (
      <RetiradaForm
        retirada={editingRetirada}
        onSuccess={handleFormSuccess}
        onCancel={() => { setShowForm(false); setEditingRetirada(null); }}
      />
    );
  }

  const pageStart = (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd   = Math.min(currentPage * PAGE_SIZE, totalQuantidade);

  return (
    <div className="space-y-6">

      {/* ── Cabeçalho ── */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Retiradas</h2>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="destructive" className="text-base px-4 py-1.5">
              Total: {formatCurrency(totalValor)}
            </Badge>
            <Badge variant="outline">
              {totalQuantidade} {totalQuantidade === 1 ? 'retirada' : 'retiradas'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Ocultar Filtros' : 'Filtros'}
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={() => { setEditingRetirada(null); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Retirada
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

              <div>
                <label className="text-sm font-medium mb-1 block">Data Início</label>
                <DatePickerWithYearSelector
                  date={tempFilters.dataInicio}
                  onDateChange={(d) => setTempFilters(f => ({ ...f, dataInicio: d }))}
                  placeholder="Data inicial"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Data Fim</label>
                <DatePickerWithYearSelector
                  date={tempFilters.dataFim}
                  onDateChange={(d) => setTempFilters(f => ({ ...f, dataFim: d }))}
                  placeholder="Data final"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Matriz</label>
                <Select
                  value={tempFilters.matrizId}
                  onValueChange={(v) => setTempFilters(f => ({ ...f, matrizId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(matrizes as any[]).map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Sócio</label>
                <Select
                  value={tempFilters.socioId}
                  onValueChange={(v) => setTempFilters(f => ({ ...f, socioId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(socios as any[]).map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Conta</label>
                <Select
                  value={tempFilters.contaId}
                  onValueChange={(v) => setTempFilters(f => ({ ...f, contaId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(contas as any[]).map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabela ── */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Sócio</TableHead>
                <TableHead>Matriz</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRetiradas ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Carregando retiradas...
                  </TableCell>
                </TableRow>
              ) : retiradasPagina.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhuma retirada encontrada
                  </TableCell>
                </TableRow>
              ) : (
                retiradasPagina.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.data_retirada)}</TableCell>
                    <TableCell className="font-medium">{r.socio_nome  || '-'}</TableCell>
                    <TableCell>{r.matriz_nome || '-'}</TableCell>
                    <TableCell>{r.conta_nome  || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {formatCurrency(parseFloat(r.valor) || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {r.observacoes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(r)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(r.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Exibindo {pageStart}–{pageEnd} de {totalQuantidade}{' '}
                {totalQuantidade === 1 ? 'retirada' : 'retiradas'}
              </p>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Números de páginas com ellipsis */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={currentPage === p ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(p as number)}
                        className="min-w-[32px]"
                      >
                        {p}
                      </Button>
                    ),
                  )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
