'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus,
  Receipt,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Edit,
  Trash2,
  CreditCard,
  Undo2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter
} from 'lucide-react';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ContasPagarForm } from './ContasPagarForm';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase } from '@/utils/timezone';
import loadContasPagarAction from '@/actions/loadContasPagar';
import countContasPagarAction from '@/actions/countContasPagar';
import loadContasAction from '@/actions/loadContas';
import loadTitulosByContaPagarAction from '@/actions/loadTitulosByContaPagar';
import deleteContaPagarAction from '@/actions/deleteContaPagar';
import payTituloPagarAction from '@/actions/payTituloPagar';
import reverseTituloPagarAction from '@/actions/reverseTituloPagar';
import { FinanceActionButton, FinanceStatusBadge } from '@/components/finance/listing-ui';

type SortColumn = 'numero_documento' | 'fornecedor_nome' | 'data_vencimento' | 'valor_total' | 'status';
type SortDirection = 'asc' | 'desc';

export function ContasPagarList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  // Helper function to format dates correctly with timezone
  const formatDateWithTimezone = (dateString: string) => {
    if (!dateString) return '-';
    // Create date object treating the string as local date to avoid timezone issues
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Temporary filters (form state)
  const [tempSearchFornecedor, setTempSearchFornecedor] = useState('');
  const [tempSearchStatus, setTempSearchStatus] = useState('all');
  const [tempSearchNumeroDocumento, setTempSearchNumeroDocumento] = useState('');
  const [tempSearchProjeto, setTempSearchProjeto] = useState('');
  const [tempSearchMatriz, setTempSearchMatriz] = useState('');
  const [tempDataVencimentoInicio, setTempDataVencimentoInicio] = useState<Date | undefined>();
  const [tempDataVencimentoFim, setTempDataVencimentoFim] = useState<Date | undefined>();
  const [tempDataPagamentoInicio, setTempDataPagamentoInicio] = useState<Date | undefined>();
  const [tempDataPagamentoFim, setTempDataPagamentoFim] = useState<Date | undefined>();

  // Applied filters (sent to API)
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [searchStatus, setSearchStatus] = useState('all');
  const [searchNumeroDocumento, setSearchNumeroDocumento] = useState('');
  const [searchProjeto, setSearchProjeto] = useState('');
  const [searchMatriz, setSearchMatriz] = useState('');
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState<Date | undefined>();
  const [dataVencimentoFim, setDataVencimentoFim] = useState<Date | undefined>();
  const [dataPagamentoInicio, setDataPagamentoInicio] = useState<Date | undefined>();
  const [dataPagamentoFim, setDataPagamentoFim] = useState<Date | undefined>();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    conta_id: '',
    data_pagamento: new Date(),
    observacoes: '',
  });

  // Check if we have active filters
  const hasFilters = useMemo(() => {
    return !!(
      searchFornecedor ||
      (searchStatus && searchStatus !== 'all') ||
      searchNumeroDocumento ||
      searchProjeto ||
      searchMatriz ||
      dataVencimentoInicio ||
      dataVencimentoFim ||
      dataPagamentoInicio ||
      dataPagamentoFim
    );
  }, [
    searchFornecedor,
    searchStatus,
    searchNumeroDocumento,
    searchProjeto,
    searchMatriz,
    dataVencimentoInicio,
    dataVencimentoFim,
    dataPagamentoInicio,
    dataPagamentoFim
  ]);

  // Mutations
  const [deleteContaPagar] = useMutateAction(deleteContaPagarAction);

  // Data loading with pagination parameters
  const [contas] = useLoadAction(loadContasAction, []);
  const [contasPagar, loading, error, refreshContasPagar] = useLoadAction(loadContasPagarAction, [], {
    searchFornecedor: searchFornecedor || null,
    searchStatus: (searchStatus && searchStatus !== 'all') ? searchStatus : null,
    searchNumeroDocumento: searchNumeroDocumento || null,
    searchProjeto: searchProjeto || null,
    searchMatriz: searchMatriz || null,
    dataVencimentoInicio: dataVencimentoInicio ? formatDateForDatabase(dataVencimentoInicio) : null,
    dataVencimentoFim: dataVencimentoFim ? formatDateForDatabase(dataVencimentoFim) : null,
    dataPagamentoInicio: dataPagamentoInicio ? formatDateForDatabase(dataPagamentoInicio) : null,
    dataPagamentoFim: dataPagamentoFim ? formatDateForDatabase(dataPagamentoFim) : null,
    hasFilters: hasFilters,
    page: hasFilters ? currentPage : null,
    limit: hasFilters ? itemsPerPage : null,
  });

  // Count total records when filters are applied
  const [totalCountResult] = useLoadAction(countContasPagarAction, [], {
    searchFornecedor: hasFilters && searchFornecedor || null,
    searchStatus: hasFilters && (searchStatus && searchStatus !== 'all') ? searchStatus : null,
    searchNumeroDocumento: hasFilters && searchNumeroDocumento || null,
    searchProjeto: hasFilters && searchProjeto || null,
    searchMatriz: hasFilters && searchMatriz || null,
    dataVencimentoInicio: hasFilters && dataVencimentoInicio ? formatDateForDatabase(dataVencimentoInicio) : null,
    dataVencimentoFim: hasFilters && dataVencimentoFim ? formatDateForDatabase(dataVencimentoFim) : null,
    dataPagamentoInicio: hasFilters && dataPagamentoInicio ? formatDateForDatabase(dataPagamentoInicio) : null,
    dataPagamentoFim: hasFilters && dataPagamentoFim ? formatDateForDatabase(dataPagamentoFim) : null,
  });

  const totalCount = totalCountResult?.[0]?.total || 0;
  const totalPages = hasFilters ? Math.ceil(totalCount / itemsPerPage) : 1;

  const handleFormSuccess = () => {
    setShowForm(false);
    refreshContasPagar();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingConta(null);
  };

  const handleEdit = (conta: any) => {
    // Check if has payments
    if (conta.titulos_pagos > 0) {
      toast({
        title: "Visualização apenas",
        description: "Esta conta possui pagamentos efetuados e só pode ser visualizada.",
      });
    }
    setEditingConta(conta);
    setShowForm(true);
  };

  const handleDelete = async (conta: any) => {
    if (conta.titulos_pagos > 0) {
      toast({
        title: "Não é possível excluir",
        description: "Esta conta possui pagamentos efetuados e não pode ser excluída.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir a conta do documento ${conta.numero_documento}?`)) {
      return;
    }

    try {
      await deleteContaPagar({ id: conta.id });
      toast({
        title: "Conta excluída",
        description: "Conta a pagar foi excluída com sucesso.",
      });
      refreshContasPagar();
    } catch (error) {
      console.error('Error deleting conta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conta.",
        variant: "destructive",
      });
    }
  };

  const handlePayment = (conta: any) => {
    setSelectedConta(conta);
    setShowPaymentModal(true);
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
    setSearchFornecedor(tempSearchFornecedor);
    setSearchStatus(tempSearchStatus);
    setSearchNumeroDocumento(tempSearchNumeroDocumento);
    setSearchProjeto(tempSearchProjeto);
    setSearchMatriz(tempSearchMatriz);
    setDataVencimentoInicio(tempDataVencimentoInicio);
    setDataVencimentoFim(tempDataVencimentoFim);
    setDataPagamentoInicio(tempDataPagamentoInicio);
    setDataPagamentoFim(tempDataPagamentoFim);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    // Clear temporary filters
    setTempSearchFornecedor('');
    setTempSearchStatus('all');
    setTempSearchNumeroDocumento('');
    setTempSearchProjeto('');
    setTempSearchMatriz('');
    setTempDataVencimentoInicio(undefined);
    setTempDataVencimentoFim(undefined);
    setTempDataPagamentoInicio(undefined);
    setTempDataPagamentoFim(undefined);
    
    // Clear applied filters
    setSearchFornecedor('');
    setSearchStatus('all');
    setSearchNumeroDocumento('');
    setSearchProjeto('');
    setSearchMatriz('');
    setDataVencimentoInicio(undefined);
    setDataVencimentoFim(undefined);
    setDataPagamentoInicio(undefined);
    setDataPagamentoFim(undefined);
    setCurrentPage(1);
  };

  // Pagination functions
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNextPage = () => setCurrentPage(Math.min(totalPages, currentPage + 1));

  const sortedContasPagar = useMemo(() => {
    if (!contasPagar || contasPagar.length === 0) return [];
    
    const sorted = [...contasPagar].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'numero_documento':
          valueA = a.numero_documento || '';
          valueB = b.numero_documento || '';
          break;
        case 'fornecedor_nome':
          valueA = a.fornecedor_nome?.toLowerCase() || '';
          valueB = b.fornecedor_nome?.toLowerCase() || '';
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
  }, [contasPagar, sortColumn, sortDirection]);

  const getSortIcon = (column: SortColumn) => {
    if (column !== sortColumn) {
      return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-slate-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-3.5 w-3.5 text-slate-500" />
      : <ArrowDown className="ml-2 h-3.5 w-3.5 text-slate-500" />;
  };

  const getStatusBadge = (status: string, titulosPagos: number, totalTitulos: number) => {
    if (status === 'PAGO_TOTAL' || titulosPagos === totalTitulos) {
      return <FinanceStatusBadge label="Pago" tone="success" />;
    } else if (status === 'PAGO_PARCIAL' || titulosPagos > 0) {
      return <FinanceStatusBadge label="Parcial" tone="warning" />;
    } else {
      return <FinanceStatusBadge label="Pendente" tone="danger" />;
    }
  };

  if (showForm) {
    return (
      <ContasPagarForm
        conta={editingConta}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando contas a pagar...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar contas a pagar: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contas a Pagar</h2>
          <p className="text-muted-foreground">
            Gerencie suas contas a pagar e obrigações financeiras
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta a Pagar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Fornecedor</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por fornecedor..."
                    value={tempSearchFornecedor}
                    onChange={(e) => setTempSearchFornecedor(e.target.value)}
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
                    <SelectItem value="PAGO_PARCIAL">Pago Parcial</SelectItem>
                    <SelectItem value="PAGO_TOTAL">Pago Total</SelectItem>
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
                <label className="text-sm font-medium mb-1 block">Pagamento - De</label>
                <DatePickerWithYearSelector
                  date={tempDataPagamentoInicio}
                  onDateChange={setTempDataPagamentoInicio}
                  placeholder="Data inicial"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Pagamento - Até</label>
                <DatePickerWithYearSelector
                  date={tempDataPagamentoFim}
                  onDateChange={setTempDataPagamentoFim}
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
          <Table className="min-w-[1120px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead>Matriz</TableHead>
                <TableHead 
                  className="w-[120px] cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('numero_documento')}
                >
                  <div className="flex items-center">
                    Documento
                    {getSortIcon('numero_documento')}
                  </div>
                </TableHead>
                <TableHead className="w-[80px] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Tipo</TableHead>
                <TableHead 
                  className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('fornecedor_nome')}
                >
                  <div className="flex items-center">
                    Fornecedor
                    {getSortIcon('fornecedor_nome')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100/70"
                  onClick={() => handleSort('data_vencimento')}
                >
                  <div className="flex items-center">
                    Vencimento
                    {getSortIcon('data_vencimento')}
                  </div>
                </TableHead>
                <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Pagamento</TableHead>
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
                <TableHead className="w-[160px] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContasPagar.map((conta: any) => (
                <TableRow key={conta.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {conta.matriz_nome || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle font-mono text-sm font-semibold text-slate-700">
                    {conta.numero_documento}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                    {conta.tipo_documento_descricao}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                    {conta.fornecedor_nome}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {formatDateWithTimezone(conta.data_vencimento)}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {conta.data_primeiro_pagamento && conta.data_ultimo_pagamento
                      ? conta.data_primeiro_pagamento === conta.data_ultimo_pagamento
                        ? formatDateWithTimezone(conta.data_primeiro_pagamento)
                        : `${formatDateWithTimezone(conta.data_primeiro_pagamento)} - ${formatDateWithTimezone(conta.data_ultimo_pagamento)}`
                      : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                    {formatCurrency(parseFloat(conta.valor_total))}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {conta.titulos_pagos}/{conta.total_titulos}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle">
                    {getStatusBadge(conta.status, conta.titulos_pagos, conta.total_titulos)}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      <FinanceActionButton icon={Edit} onClick={() => handleEdit(conta)} title="Editar" tone="brand" />
                      {conta.titulos_pagos === 0 && (
                        <FinanceActionButton icon={Trash2} onClick={() => handleDelete(conta)} title="Excluir" tone="danger" />
                      )}
                      <FinanceActionButton icon={CreditCard} onClick={() => handlePayment(conta)} title="Baixar/Pagar" tone="success" />
                      {conta.titulos_pagos > 0 && (
                        <FinanceActionButton icon={Undo2} onClick={() => handleReverse(conta)} title="Estornar Pagamento" tone="warning" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedContasPagar.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center">
                      <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma conta a pagar cadastrada</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece criando sua primeira conta a pagar.
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeira conta a pagar
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

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Efetuar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedConta && (
            <PaymentModalContent
              conta={selectedConta}
              contas={contas}
              onClose={() => setShowPaymentModal(false)}
              onSuccess={() => {
                setShowPaymentModal(false);
                refreshContasPagar();
                toast({
                  title: "Pagamento realizado",
                  description: "Pagamento efetuado com sucesso.",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reverse Payment Modal */}
      <Dialog open={showReverseModal} onOpenChange={setShowReverseModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Estornar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedConta && (
            <ReversePaymentModalContent
              conta={selectedConta}
              onClose={() => setShowReverseModal(false)}
              onSuccess={() => {
                setShowReverseModal(false);
                refreshContasPagar();
                toast({
                  title: "Estorno realizado",
                  description: "Pagamento estornado com sucesso.",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReversePaymentModalContent({ conta, onClose, onSuccess }: ReversePaymentModalContentProps) {
  const { formatCurrency } = useCurrency();
  const [titulos, loading] = useLoadAction(loadTitulosByContaPagarAction, [], { contaPagarId: conta.id });
  const [reverseTituloPagar] = useMutateAction(reverseTituloPagarAction);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);

  const handleReverse = async () => {
    if (selectedTitulos.length === 0) return;

    try {
      for (const tituloId of selectedTitulos) {
        const titulo = titulos.find((t: any) => t.id === tituloId);
        if (titulo && titulo.status === 'PAGO') {
          await reverseTituloPagar({ id: titulo.id });
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

  const paidTitulos = titulos?.filter((t: any) => t.status === 'PAGO') || [];

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-yellow-50">
        <p className="text-sm text-yellow-800">
          <strong>Atenção:</strong> Esta operação irá estornar os pagamentos selecionados, 
          revertendo-os para o status pendente. Esta ação não pode ser desfeita.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Títulos Pagos para Estorno</label>
        {paidTitulos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum título pago encontrado para estorno.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className="w-[50px]">Estornar</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data Pagamento</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paidTitulos.map((titulo: any) => (
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
                  <TableCell>{new Date(titulo.data_vencimento).toLocaleDateString()}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(titulo.valor))}</TableCell>
                  <TableCell>
                    {titulo.data_pagamento ? new Date(titulo.data_pagamento).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    {titulo.conta_nome ? `${titulo.conta_banco} - ${titulo.conta_nome}` : '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={titulo.observacoes_pagamento}>
                    {titulo.observacoes_pagamento || '-'}
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
          Estornar Pagamentos
        </Button>
      </DialogFooter>
    </div>
  );
}

interface PaymentModalContentProps {
  conta: any;
  contas: any[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ReversePaymentModalContentProps {
  conta: any;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModalContent({ conta, contas, onClose, onSuccess }: PaymentModalContentProps) {
  const { formatCurrency } = useCurrency();
  const [titulos, loading] = useLoadAction(loadTitulosByContaPagarAction, [], { contaPagarId: conta.id });
  const [payTituloPagar] = useMutateAction(payTituloPagarAction);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    conta_id: '',
    data_pagamento: new Date(),
    observacoes: '',
  });

  const handlePayment = async () => {
    if (!paymentForm.conta_id || selectedTitulos.length === 0) return;

    try {
      for (const tituloId of selectedTitulos) {
        const titulo = titulos.find((t: any) => t.id === tituloId);
        if (titulo && titulo.status !== 'PAGO') {
          await payTituloPagar({
            id: titulo.id,
            valor_pago: titulo.valor,
            data_pagamento: formatDateForDatabase(paymentForm.data_pagamento),
            conta_id: parseInt(paymentForm.conta_id),
            observacoes_pagamento: paymentForm.observacoes,
          });
        }
      }
      onSuccess();
    } catch (error) {
      console.error('Error paying títulos:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Carregando títulos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Conta para Pagamento</label>
          <Select value={paymentForm.conta_id} onValueChange={(value) => setPaymentForm({...paymentForm, conta_id: value})}>
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
          <label className="text-sm font-medium mb-1 block">Data do Pagamento</label>
          <DatePickerWithYearSelector
            date={paymentForm.data_pagamento}
            onDateChange={(date) => setPaymentForm({...paymentForm, data_pagamento: date || new Date()})}
            placeholder="Selecione a data"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Observações</label>
        <Input
          placeholder="Observações do pagamento"
          value={paymentForm.observacoes}
          onChange={(e) => setPaymentForm({...paymentForm, observacoes: e.target.value})}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Títulos para Pagamento</label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Pagar</TableHead>
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
                    disabled={titulo.status === 'PAGO'}
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
                <TableCell>{new Date(titulo.data_vencimento).toLocaleDateString()}</TableCell>
                <TableCell>{formatCurrency(parseFloat(titulo.valor))}</TableCell>
                <TableCell>
                  <Badge variant={titulo.status === 'PAGO' ? 'default' : 'destructive'}>
                    {titulo.status === 'PAGO' ? 'Pago' : 'Pendente'}
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
        <Button onClick={handlePayment} disabled={!paymentForm.conta_id || selectedTitulos.length === 0}>
          <CreditCard className="mr-2 h-4 w-4" />
          Efetuar Pagamento
        </Button>
      </DialogFooter>
    </div>
  );
}
