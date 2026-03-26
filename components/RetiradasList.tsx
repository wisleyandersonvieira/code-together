'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  exportRetiradasPDF,
  exportRetiradasExcel,
  type RetiradasRow,
} from '@/utils/retiradas-export';

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
    dataFim:    undefined as Date | undefined,
    matrizId:   'all',
    socioId:    'all',
    contaId:    'all',
  });

  // Filtros aplicados (enviados ao backend)
  const [appliedFilters, setAppliedFilters] = useState({
    dataInicio: undefined as Date | undefined,
    dataFim:    undefined as Date | undefined,
    matrizId:   'all',
    socioId:    'all',
    contaId:    'all',
  });

  const actionFilters = useMemo(() => ({
    dataInicio: appliedFilters.dataInicio ? toDBDate(appliedFilters.dataInicio) : null,
    dataFim:    appliedFilters.dataFim    ? toDBDate(appliedFilters.dataFim)    : null,
    matrizId:   appliedFilters.matrizId !== 'all' ? appliedFilters.matrizId : null,
    socioId:    appliedFilters.socioId  !== 'all' ? appliedFilters.socioId  : null,
    contaId:    appliedFilters.contaId  !== 'all' ? appliedFilters.contaId  : null,
  }), [appliedFilters]);

  const [retiradas, loadingRetiradas, , refreshRetiradas] = useLoadAction(loadRetiradasAction, [], actionFilters);
  const [socios]   = useLoadAction(loadSociosAction,   [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas]   = useLoadAction(loadContasAction, []);
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

  // ── Descrição dos filtros ativos (para exports) ────────────────────────────
  const filtrosDesc = useMemo(() => {
    const parts: string[] = [];
    if (appliedFilters.dataInicio && appliedFilters.dataFim) parts.push(`Período: ${periodoLabel}`);
    const socioSel  = (socios  as any[]).find(s => s.id.toString() === appliedFilters.socioId);
    const matrizSel = (matrizes as any[]).find(m => m.id.toString() === appliedFilters.matrizId);
    const contaSel  = (contas   as any[]).find(c => c.id.toString() === appliedFilters.contaId);
    if (socioSel)  parts.push(`Sócio: ${socioSel.nome}`);
    if (matrizSel) parts.push(`Matriz: ${matrizSel.nome}`);
    if (contaSel)  parts.push(`Conta: ${contaSel.nome}`);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  }, [appliedFilters, socios, matrizes, contas, periodoLabel]);

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!(retiradas as any[]).length) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }
    try {
      exportRetiradasExcel(
        retiradas as RetiradasRow[],
        { periodoLabel, filtrosDesc },
        { formatCurrency },
      );
      toast({ title: 'Sucesso', description: 'Relatório exportado para Excel com sucesso!' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao exportar para Excel.', variant: 'destructive' });
    }
  };

  // ── Exportar PDF ───────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    if (!(retiradas as any[]).length) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }
    try {
      exportRetiradasPDF(
        retiradas as RetiradasRow[],
        { periodoLabel, filtrosDesc },
        { formatCurrency },
      );
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

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`e-${i}`} className="px-1.5 text-sm text-muted-foreground">...</span>
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
