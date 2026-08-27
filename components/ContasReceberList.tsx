'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { sanitizeSearchParam } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus,
  Receipt,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Edit,
  Eye,
  Trash2,
  CreditCard,
  Undo2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal
} from 'lucide-react';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ContasReceberForm } from './ContasReceberForm';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, formatDateForDisplay } from '@/utils/timezone';
import loadContasReceberAction from '@/actions/loadContasReceber';
import countContasReceberAction from '@/actions/countContasReceber';
import loadContasAction from '@/actions/loadContas';
import loadTitulosByContaReceberAction from '@/actions/loadTitulosByContaReceber';
import deleteContaReceberAction from '@/actions/deleteContaReceber';
import receiveTituloReceberAction from '@/actions/receiveTituloReceber';
import reverseTituloReceberAction from '@/actions/reverseTituloReceber';
import { FinanceActionButton, FinanceStatusBadge } from '@/components/finance/listing-ui';

type SortColumn = 'numero_documento' | 'cliente_nome' | 'data_vencimento' | 'valor_total' | 'status';
type SortDirection = 'asc' | 'desc';

export function ContasReceberList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [viewingConta, setViewingConta] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Temporary filters (form state)
  const [tempSearchCliente, setTempSearchCliente] = useState('');
  const [tempSearchStatus, setTempSearchStatus] = useState('all');
  const [tempSearchNumeroDocumento, setTempSearchNumeroDocumento] = useState('');
  const [tempSearchProjeto, setTempSearchProjeto] = useState('');
  const [tempSearchMatriz, setTempSearchMatriz] = useState('');
  const [tempDataVencimentoInicio, setTempDataVencimentoInicio] = useState<Date | undefined>();
  const [tempDataVencimentoFim, setTempDataVencimentoFim] = useState<Date | undefined>();
  const [tempDataRecebimentoInicio, setTempDataRecebimentoInicio] = useState<Date | undefined>();
  const [tempDataRecebimentoFim, setTempDataRecebimentoFim] = useState<Date | undefined>();

  // Applied filters (sent to API)
  const [searchCliente, setSearchCliente] = useState('');
  const [searchStatus, setSearchStatus] = useState('all');
  const [searchNumeroDocumento, setSearchNumeroDocumento] = useState('');
  const [searchProjeto, setSearchProjeto] = useState('');
  const [searchMatriz, setSearchMatriz] = useState('');
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState<Date | undefined>();
  const [dataVencimentoFim, setDataVencimentoFim] = useState<Date | undefined>();
  const [dataRecebimentoInicio, setDataRecebimentoInicio] = useState<Date | undefined>();
  const [dataRecebimentoFim, setDataRecebimentoFim] = useState<Date | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);

  // Check if we have active filters
  const hasFilters = useMemo(() => {
    return !!(
      searchCliente ||
      (searchStatus && searchStatus !== 'all') ||
      searchNumeroDocumento ||
      searchProjeto ||
      searchMatriz ||
      dataVencimentoInicio ||
      dataVencimentoFim ||
      dataRecebimentoInicio ||
      dataRecebimentoFim
    );
  }, [
    searchCliente,
    searchStatus,
    searchNumeroDocumento,
    searchProjeto,
    searchMatriz,
    dataVencimentoInicio,
    dataVencimentoFim,
    dataRecebimentoInicio,
    dataRecebimentoFim
  ]);

  // Mutations
  const [deleteContaReceber] = useMutateAction(deleteContaReceberAction);

  // Data loading with pagination parameters
  const [contas] = useLoadAction(loadContasAction, []);
  const [contasReceber, loading, error, refreshContasReceber] = useLoadAction(loadContasReceberAction, [], {
    searchCliente: searchCliente ? sanitizeSearchParam(searchCliente) : null,
    searchStatus: (searchStatus && searchStatus !== 'all') ? searchStatus : null,
    searchNumeroDocumento: searchNumeroDocumento ? sanitizeSearchParam(searchNumeroDocumento) : null,
    searchProjeto: searchProjeto ? sanitizeSearchParam(searchProjeto) : null,
    searchMatriz: searchMatriz ? sanitizeSearchParam(searchMatriz) : null,
    dataVencimentoInicio: dataVencimentoInicio ? formatDateForDatabase(dataVencimentoInicio) : null,
    dataVencimentoFim: dataVencimentoFim ? formatDateForDatabase(dataVencimentoFim) : null,
    dataRecebimentoInicio: dataRecebimentoInicio ? formatDateForDatabase(dataRecebimentoInicio) : null,
    dataRecebimentoFim: dataRecebimentoFim ? formatDateForDatabase(dataRecebimentoFim) : null,
    hasFilters: hasFilters,
    page: hasFilters ? currentPage : null,
    limit: hasFilters ? itemsPerPage : null,
  });

  // Count total records when filters are applied
  const [totalCountResult] = useLoadAction(countContasReceberAction, [], {
    skipCount: !hasFilters,
    searchCliente: hasFilters && searchCliente ? sanitizeSearchParam(searchCliente) : null,
    searchStatus: hasFilters && (searchStatus && searchStatus !== 'all') ? searchStatus : null,
    searchNumeroDocumento: hasFilters && searchNumeroDocumento ? sanitizeSearchParam(searchNumeroDocumento) : null,
    searchProjeto: hasFilters && searchProjeto ? sanitizeSearchParam(searchProjeto) : null,
    searchMatriz: hasFilters && searchMatriz ? sanitizeSearchParam(searchMatriz) : null,
    dataVencimentoInicio: hasFilters && dataVencimentoInicio ? formatDateForDatabase(dataVencimentoInicio) : null,
    dataVencimentoFim: hasFilters && dataVencimentoFim ? formatDateForDatabase(dataVencimentoFim) : null,
    dataRecebimentoInicio: hasFilters && dataRecebimentoInicio ? formatDateForDatabase(dataRecebimentoInicio) : null,
    dataRecebimentoFim: hasFilters && dataRecebimentoFim ? formatDateForDatabase(dataRecebimentoFim) : null,
  });

  const totalCount = totalCountResult?.[0]?.total || 0;
  const totalPages = hasFilters ? Math.ceil(totalCount / itemsPerPage) : 1;

  const handleFormSuccess = () => {
    setShowForm(false);
    refreshContasReceber();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingConta(null);
    setViewingConta(null);
  };

  const handleView = (conta: any) => {
    setViewingConta(conta);
    setEditingConta(conta);
    setShowForm(true);
  };

  const handleEdit = (conta: any) => {
    setViewingConta(null);
    // Check if has receipts
    if (conta.titulos_recebidos > 0) {
      toast({
        title: "Visualização apenas",
        description: "Esta conta possui recebimentos efetuados e só pode ser visualizada.",
      });
    }
    setEditingConta(conta);
    setShowForm(true);
  };

  const handleDelete = async (conta: any) => {
    if (conta.titulos_recebidos > 0) {
      toast({
        title: "Não é possível excluir",
        description: "Esta conta possui recebimentos efetuados e não pode ser excluída.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir a conta do documento ${conta.numero_documento}?`)) {
      return;
    }

    try {
      await deleteContaReceber({ id: conta.id });
      toast({
        title: "Conta excluída",
        description: "Conta a receber foi excluída com sucesso.",
      });
      refreshContasReceber();
    } catch (error) {
      console.error('Error deleting conta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conta.",
        variant: "destructive",
      });
    }
  };

  const handleReceipt = (conta: any) => {
    setSelectedConta(conta);
    setShowReceiptModal(true);
  };

  const handleReverse = (conta: any) => {
    setSelectedConta(conta);
    setShowReverseModal(true);
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const applyFilters = () => {
    setSearchCliente(tempSearchCliente);
    setSearchStatus(tempSearchStatus);
    setSearchNumeroDocumento(tempSearchNumeroDocumento);
    setSearchProjeto(tempSearchProjeto);
    setSearchMatriz(tempSearchMatriz);
    setDataVencimentoInicio(tempDataVencimentoInicio);
    setDataVencimentoFim(tempDataVencimentoFim);
    setDataRecebimentoInicio(tempDataRecebimentoInicio);
    setDataRecebimentoFim(tempDataRecebimentoFim);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    // Clear temporary filters
    setTempSearchCliente('');
    setTempSearchStatus('all');
    setTempSearchNumeroDocumento('');
    setTempSearchProjeto('');
    setTempSearchMatriz('');
    setTempDataVencimentoInicio(undefined);
    setTempDataVencimentoFim(undefined);
    setTempDataRecebimentoInicio(undefined);
    setTempDataRecebimentoFim(undefined);
    
    // Clear applied filters
    setSearchCliente('');
    setSearchStatus('all');
    setSearchNumeroDocumento('');
    setSearchProjeto('');
    setSearchMatriz('');
    setDataVencimentoInicio(undefined);
    setDataVencimentoFim(undefined);
    setDataRecebimentoInicio(undefined);
    setDataRecebimentoFim(undefined);
    setCurrentPage(1);
  };

  // Pagination functions
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNextPage = () => setCurrentPage(Math.min(totalPages, currentPage + 1));

  const sortedContasReceber = useMemo(() => {
    if (!contasReceber || contasReceber.length === 0) return [];
    
    const sorted = [...contasReceber].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'numero_documento':
          valueA = a.numero_documento || '';
          valueB = b.numero_documento || '';
          break;
        case 'cliente_nome':
          valueA = a.cliente_nome?.toLowerCase() || '';
          valueB = b.cliente_nome?.toLowerCase() || '';
          break;
        case 'data_vencimento':
          valueA = a.data_vencimento || '';
          valueB = b.data_vencimento || '';
          break;
        case 'valor_total':
          valueA = parseFloat(a.valor_total) || 0;
          valueB = parseFloat(b.valor_total) || 0;
          break;
        case 'status':
          valueA = a.status || '';
          valueB = b.status || '';
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [contasReceber, sortColumn, sortDirection]);

  const getSortIcon = (column: SortColumn) => {
    if (column !== sortColumn) {
      return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-slate-500" />
      : <ArrowDown className="ml-2 h-3.5 w-3.5 text-slate-500" />;
  };

  const getStatusBadge = (status: string, titulosRecebidos: number, totalTitulos: number) => {
    if (status === 'RECEBIDO_TOTAL' || titulosRecebidos === totalTitulos) {
      return <FinanceStatusBadge label="Recebido" tone="success" />;
    } else if (status === 'RECEBIDO_PARCIAL' || titulosRecebidos > 0) {
      return <FinanceStatusBadge label="Parcial" tone="warning" />;
    } else {
      return <FinanceStatusBadge label="Pendente" tone="danger" />;
    }
  };

  if (showForm) {
    return (
      <ContasReceberForm
        conta={editingConta}
        readOnly={!!viewingConta}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando contas a receber...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar contas a receber: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contas a Receber</h2>
          <p className="text-muted-foreground">
            Gerencie suas contas a receber e receitas futuras
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta a Receber
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Cliente</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={tempSearchCliente}
                    onChange={(e) => setTempSearchCliente(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Nº Documento</label>
                <Input
                  placeholder="Filtrar por documento..."
                  value={tempSearchNumeroDocumento}
                  onChange={(e) => setTempSearchNumeroDocumento(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Projeto</label>
                <Input
                  placeholder="Filtrar por projeto..."
                  value={tempSearchProjeto}
                  onChange={(e) => setTempSearchProjeto(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Matriz</label>
                <Input
                  placeholder="Filtrar por matriz..."
                  value={tempSearchMatriz}
                  onChange={(e) => setTempSearchMatriz(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={tempSearchStatus} onValueChange={setTempSearchStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="RECEBIDO_PARCIAL">Recebido Parcial</SelectItem>
                    <SelectItem value="RECEBIDO_TOTAL">Recebido Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Vencimento - De</label>
                <DatePickerWithYearSelector
                  date={tempDataVencimentoInicio}
                  onDateChange={setTempDataVencimentoInicio}
                  placeholder="Data inicial"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Vencimento - Até</label>
                <DatePickerWithYearSelector
                  date={tempDataVencimentoFim}
                  onDateChange={setTempDataVencimentoFim}
                  placeholder="Data final"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Recebimento - De</label>
                <DatePickerWithYearSelector
                  date={tempDataRecebimentoInicio}
                  onDateChange={setTempDataRecebimentoInicio}
                  placeholder="Data inicial"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Recebimento - Até</label>
                <DatePickerWithYearSelector
                  date={tempDataRecebimentoFim}
                  onDateChange={setTempDataRecebimentoFim}
                  placeholder="Data final"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button onClick={applyFilters}>
                <Filter className="h-4 w-4 mr-2" />
                FILTRAR
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <CardContent className="p-0">
          <Table className="min-w-[1040px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead 
                  className="w-[120px] cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('numero_documento')}
                >
                  <div className="flex items-center">
                    Documento
                    {getSortIcon('numero_documento')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('cliente_nome')}
                >
                  <div className="flex items-center">
                    Cliente
                    {getSortIcon('cliente_nome')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('valor_total')}
                >
                  <div className="flex items-center">
                    Valor Total
                    {getSortIcon('valor_total')}
                  </div>
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Títulos</TableHead>
                <TableHead 
                  className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="w-[120px] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContasReceber.map((conta: any) => (
                <TableRow key={conta.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className="px-4 py-3.5 align-middle font-mono text-sm font-semibold text-slate-700">
                    {conta.numero_documento}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                    {conta.cliente_nome}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {conta.matriz_nome || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-700">
                    {conta.tipo_documento_descricao}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {formatDateForDisplay(conta.data_vencimento)}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                    {formatCurrency(parseFloat(conta.valor_total))}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {conta.titulos_recebidos}/{conta.total_titulos}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle">
                    {getStatusBadge(conta.status, conta.titulos_recebidos, conta.total_titulos)}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      <FinanceActionButton icon={Eye} onClick={() => handleView(conta)} title="Visualizar" tone="neutral" />
                      <FinanceActionButton icon={Edit} onClick={() => handleEdit(conta)} title="Editar" tone="brand" />
                      {Number(conta.titulos_recebidos) === 0 && (
                        <FinanceActionButton icon={Trash2} onClick={() => handleDelete(conta)} title="Excluir" tone="danger" />
                      )}
                      <FinanceActionButton icon={CreditCard} onClick={() => handleReceipt(conta)} title="Baixar/Receber" tone="success" />
                      {conta.titulos_recebidos > 0 && (
                        <FinanceActionButton icon={Undo2} onClick={() => handleReverse(conta)} title="Estornar Recebimento" tone="warning" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedContasReceber.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-14 text-center">
                    <div className="flex flex-col items-center">
                      <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma conta a receber cadastrada</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece criando sua primeira conta a receber.
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeira conta a receber
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {hasFilters && totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Exibindo {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
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
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card for Default View */}
      {!hasFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">
                Exibindo as 5 últimas contas cadastradas. Use os filtros acima para buscar e exibir todas as contas com paginação.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receipt Modal */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Efetuar Recebimento</DialogTitle>
          </DialogHeader>
          {selectedConta && (
            <ReceiptModalContent
              conta={selectedConta}
              contas={contas}
              onClose={() => setShowReceiptModal(false)}
              onSuccess={() => {
                setShowReceiptModal(false);
                refreshContasReceber();
                toast({
                  title: "Recebimento realizado",
                  description: "Recebimento efetuado com sucesso.",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reverse Receipt Modal */}
      <Dialog open={showReverseModal} onOpenChange={setShowReverseModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Estornar Recebimento</DialogTitle>
          </DialogHeader>
          {selectedConta && (
            <ReverseReceiptModalContent
              conta={selectedConta}
              onClose={() => setShowReverseModal(false)}
              onSuccess={() => {
                setShowReverseModal(false);
                refreshContasReceber();
                toast({
                  title: "Estorno realizado",
                  description: "Recebimento estornado com sucesso.",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReverseReceiptModalContent({ conta, onClose, onSuccess }: ReverseReceiptModalContentProps) {
  const { formatCurrency } = useCurrency();
  const [titulos, loading] = useLoadAction(loadTitulosByContaReceberAction, [], { contaReceberId: conta.id });
  const [reverseTituloReceber] = useMutateAction(reverseTituloReceberAction);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);

  const handleReverse = async () => {
    if (selectedTitulos.length === 0) return;

    try {
      for (const tituloId of selectedTitulos) {
        const titulo = titulos.find((t: any) => t.id === tituloId);
        if (titulo && titulo.status === 'RECEBIDO') {
          await reverseTituloReceber({ id: titulo.id });
        }
      }
      onSuccess();
    } catch (error) {
      console.error('Error reversing títulos:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Carregando títulos...</div>;
  }

  const receivedTitulos = titulos?.filter((t: any) => t.status === 'RECEBIDO') || [];

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-yellow-50">
        <p className="text-sm text-yellow-800">
          <strong>Atenção:</strong> Esta operação irá estornar os recebimentos selecionados, 
          revertendo-os para o status pendente. Esta ação não pode ser desfeita.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Títulos Recebidos para Estorno</label>
        {receivedTitulos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum título recebido encontrado para estorno.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className="w-[50px]">Estornar</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data Recebimento</TableHead>
                <TableHead>Conta de Recebimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivedTitulos.map((titulo: any) => (
                <TableRow key={titulo.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedTitulos.includes(titulo.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTitulos([...selectedTitulos, titulo.id]);
                        } else {
                          setSelectedTitulos(selectedTitulos.filter(id => id !== titulo.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>{titulo.parcela}/{titulo.total_parcelas}</TableCell>
                  <TableCell>{formatDateForDisplay(titulo.data_vencimento)}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(titulo.valor))}</TableCell>
                  <TableCell>
                    {formatDateForDisplay(titulo.data_recebimento)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={titulo.conta_nome ? `${titulo.conta_nome}${titulo.banco ? ' - ' + titulo.banco : ''}` : ''}>
                    {titulo.conta_nome ? `${titulo.conta_nome}${titulo.banco ? ' - ' + titulo.banco : ''}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleReverse} 
          disabled={selectedTitulos.length === 0}
          variant="destructive"
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Estornar Recebimentos
        </Button>
      </DialogFooter>
    </div>
  );
}

interface ReceiptModalContentProps {
  conta: any;
  contas: any[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ReverseReceiptModalContentProps {
  conta: any;
  onClose: () => void;
  onSuccess: () => void;
}

function ReceiptModalContent({ conta, contas, onClose, onSuccess }: ReceiptModalContentProps) {
  const { formatCurrency } = useCurrency();
  const [titulos, loading] = useLoadAction(loadTitulosByContaReceberAction, [], { contaReceberId: conta.id });
  const [receiveTituloReceber] = useMutateAction(receiveTituloReceberAction);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);
  const [receiptForm, setReceiptForm] = useState({
    conta_id: '',
    data_recebimento: new Date(),
    observacoes: '',
  });

  const handleReceipt = async () => {
    if (!receiptForm.conta_id || selectedTitulos.length === 0) return;

    try {
      for (const tituloId of selectedTitulos) {
        const titulo = titulos.find((t: any) => t.id === tituloId);
        if (titulo && titulo.status !== 'RECEBIDO') {
          await receiveTituloReceber({
            id: titulo.id,
            valor_recebido: titulo.valor,
            data_recebimento: formatDateForDatabase(receiptForm.data_recebimento),
            conta_id: parseInt(receiptForm.conta_id),
            observacoes_recebimento: receiptForm.observacoes,
          });
        }
      }
      onSuccess();
    } catch (error) {
      console.error('Error receiving títulos:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Carregando títulos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Conta para Recebimento</label>
          <Select value={receiptForm.conta_id} onValueChange={(value) => setReceiptForm({...receiptForm, conta_id: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas?.map((conta: any) => (
                <SelectItem key={conta.id} value={conta.id.toString()}>
                  {conta.banco} - {conta.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Data do Recebimento</label>
          <DatePickerWithYearSelector
            date={receiptForm.data_recebimento}
            onDateChange={(date) => setReceiptForm({...receiptForm, data_recebimento: date || new Date()})}
            placeholder="Selecione a data"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Observações</label>
        <Input
          placeholder="Observações do recebimento"
          value={receiptForm.observacoes}
          onChange={(e) => setReceiptForm({...receiptForm, observacoes: e.target.value})}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Títulos para Recebimento</label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Receber</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {titulos?.map((titulo: any) => (
              <TableRow key={titulo.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    disabled={titulo.status === 'RECEBIDO'}
                    checked={selectedTitulos.includes(titulo.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTitulos([...selectedTitulos, titulo.id]);
                      } else {
                        setSelectedTitulos(selectedTitulos.filter(id => id !== titulo.id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>{titulo.parcela}/{titulo.total_parcelas}</TableCell>
                <TableCell>{formatDateForDisplay(titulo.data_vencimento)}</TableCell>
                <TableCell>{formatCurrency(parseFloat(titulo.valor))}</TableCell>
                <TableCell>
                  <Badge variant={titulo.status === 'RECEBIDO' ? 'default' : 'destructive'}>
                    {titulo.status === 'RECEBIDO' ? 'Recebido' : 'Pendente'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleReceipt} disabled={!receiptForm.conta_id || selectedTitulos.length === 0}>
          <CreditCard className="mr-2 h-4 w-4" />
          Efetuar Recebimento
        </Button>
      </DialogFooter>
    </div>
  );
}
