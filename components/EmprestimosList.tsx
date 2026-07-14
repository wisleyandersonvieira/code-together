// Change note: Listagem de empréstimos e pagamentos de empréstimo com filtros, paginação e exportação
'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus,
  Edit,
  Trash2,
  HandCoins,
  Calendar,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { EmprestimoForm, type EmprestimoTipo } from '@/components/EmprestimoForm';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadEmprestimosAction from '@/actions/loadEmprestimos';
import countEmprestimosAction from '@/actions/countEmprestimos';
import sumEmprestimosAction from '@/actions/sumEmprestimos';
import deleteEmprestimoAction from '@/actions/deleteEmprestimo';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import {
  exportEmprestimosPDF,
  exportEmprestimosExcel,
  type EmprestimosRow,
} from '@/utils/emprestimos-export';

const ITEMS_PER_PAGE = 10;

type Emprestimo = {
  id: number;
  tipo: EmprestimoTipo;
  socio_id: number;
  matriz_id: number;
  conta_id: number;
  data_emprestimo: string;
  valor: number;
  observacoes?: string;
  socio_nome: string;
  matriz_nome: string;
  conta_nome: string;
  created_at: string;
};

type Socio = { id: number; nome: string };
type Matriz = { id: number; nome: string };
type Conta = { id: number; nome: string };

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-';
  const [ano, mes, dia] = dateString.split('T')[0].split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : '-';
}

export function EmprestimosList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTipo, setFormTipo] = useState<EmprestimoTipo>('EMPRESTIMO');
  const [editingEmprestimo, setEditingEmprestimo] = useState<Emprestimo | null>(null);

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [matrizId, setMatrizId] = useState<number | null>(null);
  const [socioId, setSocioId] = useState<number | null>(null);
  const [contaId, setContaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState(1);

  const hasFilters = useMemo(
    () => !!(dataInicio || dataFim || matrizId || socioId || contaId || (tipo && tipo !== 'all')),
    [dataInicio, dataFim, matrizId, socioId, contaId, tipo],
  );

  // Filtros enviados às actions (sem paginação)
  const filterParams = useMemo(
    () => ({
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
      matrizId,
      socioId,
      contaId,
      tipo: tipo !== 'all' ? tipo : null,
    }),
    [dataInicio, dataFim, matrizId, socioId, contaId, tipo],
  );

  // Sem filtros: últimos 5 registros. Com filtros: 10 por página com navegação.
  const [emprestimos, loading, error, refreshEmprestimos] = useLoadAction(loadEmprestimosAction, [], {
    ...filterParams,
    hasFilters,
    page: hasFilters ? currentPage : null,
  });

  const [totalCountResult] = useLoadAction(countEmprestimosAction, [], {
    ...filterParams,
    skipCount: !hasFilters,
  });

  // Totais sempre sobre o conjunto FILTRADO completo (ignora a paginação)
  const [totaisResult] = useLoadAction(sumEmprestimosAction, [], filterParams);

  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);

  const [deleteEmprestimo, isDeleting] = useMutateAction(deleteEmprestimoAction);
  // Busca sob demanda do conjunto filtrado completo para exportação
  const [fetchEmprestimosParaExport] = useMutateAction(loadEmprestimosAction);

  const totalCount = Number(totalCountResult?.[0]?.total) || 0;
  const totalPages = hasFilters ? Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE)) : 1;

  const totalEmprestimos = Number(totaisResult?.[0]?.total_emprestimos) || 0;
  const totalPagamentos = Number(totaisResult?.[0]?.total_pagamentos) || 0;
  const saldoDevedor = Number(totaisResult?.[0]?.saldo_devedor) || 0;
  const quantidade = Number(totaisResult?.[0]?.quantidade) || 0;

  const handleDelete = async (registro: Emprestimo) => {
    const rotulo = registro.tipo === 'PAGAMENTO' ? 'este pagamento de empréstimo' : 'este empréstimo';
    if (!confirm(`Tem certeza que deseja excluir ${rotulo}?`)) return;

    try {
      await deleteEmprestimo({ id: registro.id });
      await refreshEmprestimos();
      toast({
        title: 'Registro excluído',
        description: 'O registro foi excluído com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o registro.',
        variant: 'destructive',
      });
    }
  };

  const openCreateForm = (novoTipo: EmprestimoTipo) => {
    setEditingEmprestimo(null);
    setFormTipo(novoTipo);
    setIsFormOpen(true);
  };

  const openEditForm = (registro: Emprestimo) => {
    setEditingEmprestimo(registro);
    setFormTipo(registro.tipo);
    setIsFormOpen(true);
  };

  const handleFormSuccess = async () => {
    setIsFormOpen(false);
    setEditingEmprestimo(null);
    await refreshEmprestimos();
  };

  const clearFilters = () => {
    setDataInicio('');
    setDataFim('');
    setMatrizId(null);
    setSocioId(null);
    setContaId(null);
    setTipo('all');
    setCurrentPage(1);
  };

  const onFilterChange = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  // ── Rótulos para exportação ────────────────────────────────────────────────
  const periodoLabel =
    dataInicio && dataFim ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}` : 'Todos os períodos';

  const filtrosDesc = useMemo(() => {
    const parts: string[] = [];
    if (dataInicio && dataFim) parts.push(`Período: ${periodoLabel}`);
    const socioSel = (socios as Socio[]).find((s) => s.id === socioId);
    const matrizSel = (matrizes as Matriz[]).find((m) => m.id === matrizId);
    const contaSel = (contas as Conta[]).find((c) => c.id === contaId);
    if (socioSel) parts.push(`Sócio: ${socioSel.nome}`);
    if (matrizSel) parts.push(`Matriz: ${matrizSel.nome}`);
    if (contaSel) parts.push(`Conta: ${contaSel.nome}`);
    if (tipo !== 'all') parts.push(`Tipo: ${tipo === 'PAGAMENTO' ? 'Pagamento' : 'Empréstimo'}`);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  }, [dataInicio, dataFim, periodoLabel, socios, matrizes, contas, socioId, matrizId, contaId, tipo]);

  /** Exporta sempre o conjunto FILTRADO completo, não apenas a página atual. */
  const loadRegistrosParaExport = async (): Promise<EmprestimosRow[]> => {
    const rows = await fetchEmprestimosParaExport({ ...filterParams, exportAll: true });
    return (rows || []) as EmprestimosRow[];
  };

  const handleExportExcel = async () => {
    try {
      const registros = await loadRegistrosParaExport();
      if (registros.length === 0) {
        toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
        return;
      }
      exportEmprestimosExcel(registros, { periodoLabel, filtrosDesc }, { formatCurrency });
      toast({ title: 'Sucesso', description: 'Relatório exportado para Excel com sucesso!' });
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast({ title: 'Erro', description: 'Falha ao exportar para Excel.', variant: 'destructive' });
    }
  };

  const handleExportPdf = async () => {
    try {
      const registros = await loadRegistrosParaExport();
      if (registros.length === 0) {
        toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
        return;
      }
      exportEmprestimosPDF(registros, { periodoLabel, filtrosDesc }, { formatCurrency });
      toast({ title: 'Sucesso', description: 'Relatório exportado para PDF com sucesso!' });
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast({ title: 'Erro', description: 'Falha ao exportar o relatório para PDF.', variant: 'destructive' });
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">Erro ao carregar empréstimos: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Empréstimos
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => openCreateForm('EMPRESTIMO')}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Empréstimo
              </Button>
              <Button variant="secondary" onClick={() => openCreateForm('PAGAMENTO')}>
                <Plus className="mr-2 h-4 w-4" />
                Pagamento de Empréstimo
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-2">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => onFilterChange(setDataInicio)(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => onFilterChange(setDataFim)(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Matriz</label>
              <Select
                value={matrizId?.toString() || 'all'}
                onValueChange={(value) => onFilterChange(setMatrizId)(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as matrizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as matrizes</SelectItem>
                  {matrizes.map((matriz: Matriz) => (
                    <SelectItem key={matriz.id} value={matriz.id.toString()}>
                      {matriz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sócio</label>
              <Select
                value={socioId?.toString() || 'all'}
                onValueChange={(value) => onFilterChange(setSocioId)(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os sócios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sócios</SelectItem>
                  {socios.map((socio: Socio) => (
                    <SelectItem key={socio.id} value={socio.id.toString()}>
                      {socio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Conta</label>
              <Select
                value={contaId?.toString() || 'all'}
                onValueChange={(value) => onFilterChange(setContaId)(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {contas.map((conta: Conta) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo</label>
              <Select value={tipo} onValueChange={(value) => onFilterChange(setTipo)(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="EMPRESTIMO">Empréstimo</SelectItem>
                  <SelectItem value="PAGAMENTO">Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards de total do período filtrado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Empréstimos</p>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalEmprestimos)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Pagamentos</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPagamentos)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                <p className={`text-2xl font-bold ${saldoDevedor > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(saldoDevedor)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" onClick={handleExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
            <Badge variant="outline">
              {quantidade} {quantidade === 1 ? 'registro' : 'registros'}
            </Badge>
          </div>

          {loading ? (
            <div className="text-center py-4">Carregando empréstimos...</div>
          ) : emprestimos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HandCoins className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum empréstimo encontrado</p>
              <p className="text-sm">Cadastre o primeiro empréstimo clicando no botão acima</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Sócio</TableHead>
                    <TableHead>Matriz</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emprestimos.map((emprestimo: Emprestimo) => {
                    const isPagamento = emprestimo.tipo === 'PAGAMENTO';
                    return (
                      <TableRow key={emprestimo.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            {formatDate(emprestimo.data_emprestimo)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPagamento ? 'default' : 'destructive'}>
                            {isPagamento ? 'Pagamento' : 'Empréstimo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{emprestimo.socio_nome}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{emprestimo.matriz_nome}</Badge>
                        </TableCell>
                        <TableCell>{emprestimo.conta_nome}</TableCell>
                        <TableCell
                          className={`text-right font-semibold ${isPagamento ? 'text-emerald-600' : 'text-rose-600'}`}
                        >
                          {isPagamento ? '+' : '-'} {formatCurrency(Number(emprestimo.valor) || 0)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{emprestimo.observacoes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditForm(emprestimo)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(emprestimo)}
                              disabled={isDeleting}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação — apenas quando há filtro ativo */}
      {hasFilters && totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-muted-foreground">
                Exibindo {pageStart} a {pageEnd} de {totalCount} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">
                Exibindo os 5 últimos registros cadastrados. Use os filtros acima para buscar e exibir todos os
                registros com paginação.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEmprestimo
                ? formTipo === 'PAGAMENTO'
                  ? 'Editar Pagamento de Empréstimo'
                  : 'Editar Empréstimo'
                : formTipo === 'PAGAMENTO'
                  ? 'Cadastrar Pagamento de Empréstimo'
                  : 'Cadastrar Empréstimo'}
            </DialogTitle>
          </DialogHeader>
          <EmprestimoForm
            key={`${formTipo}-${editingEmprestimo?.id ?? 'novo'}`}
            tipo={formTipo}
            emprestimo={editingEmprestimo}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingEmprestimo(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
