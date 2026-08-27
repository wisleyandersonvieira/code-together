'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { sanitizeSearchParam } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
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
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Edit,
  Eye,
  CreditCard,
  Undo2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  List,
  Loader2,
  MoreHorizontal
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
import loadContaPagarDetalhesAction from '@/actions/loadContaPagarDetalhes';
import loadFornecedoresAction from '@/actions/loadFornecedores';
import loadProjetosAction from '@/actions/loadProjetos';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadTitulosByContaPagarAction from '@/actions/loadTitulosByContaPagar';
import deleteContaPagarAction from '@/actions/deleteContaPagar';
import reverseTituloPagarAction from '@/actions/reverseTituloPagar';
import { FinanceActionButton, FinanceStatusBadge } from '@/components/finance/listing-ui';
import { PaymentModalContent } from '@/components/ContasPagarPaymentModal';

type SortColumn = 'numero_documento' | 'fornecedor_nome' | 'data_vencimento' | 'valor_total' | 'status';
type SortDirection = 'asc' | 'desc';

export function ContasPagarList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  // Helper function to format dates correctly with timezone
  const formatDateWithTimezone = (dateString: string) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') return '-';
    const clean = dateString.toString().trim().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return '-';
    const [year, month, day] = clean.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [viewingConta, setViewingConta] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Temporary filters (form state — bound directly to inputs)
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

  // "Exibir dados" — per-title detail (products / accounting groups / projects)
  const [exibirDados, setExibirDados] = useState(false);
  const [detalhes, setDetalhes] = useState<Record<number, { itens: any[]; projetos: any[] }>>({});
  const [detalhesLoading, setDetalhesLoading] = useState(false);
  const [loadContaPagarDetalhes] = useMutateAction(loadContaPagarDetalhesAction);

  // Dropdown option sources for the filters (Fornecedor / Projeto / Matriz)
  const [fornecedores] = useLoadAction(loadFornecedoresAction, []);
  const [projetos] = useLoadAction(loadProjetosAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, []);

  const fornecedorOptions = useMemo(() => {
    const opts = (fornecedores || [])
      .map((f: any) => ({ value: f.name || '', label: f.name || '' }))
      .filter((o: { value: string }) => o.value)
      .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
    return [{ value: '', label: 'Todos' }, ...opts];
  }, [fornecedores]);

  const projetoOptions = useMemo(() => {
    const opts = (projetos || [])
      .map((p: any) => ({ value: p.name || '', label: p.name || '' }))
      .filter((o: { value: string }) => o.value)
      .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
    return [{ value: '', label: 'Todos' }, ...opts];
  }, [projetos]);

  const matrizOptions = useMemo(() => {
    const opts = (matrizes || [])
      .map((m: any) => ({ value: m.nome || '', label: m.nome || '' }))
      .filter((o: { value: string }) => o.value)
      .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
    return [{ value: '', label: 'Todos' }, ...opts];
  }, [matrizes]);

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
    searchFornecedor: searchFornecedor ? sanitizeSearchParam(searchFornecedor) : null,
    searchStatus: (searchStatus && searchStatus !== 'all') ? searchStatus : null,
    searchNumeroDocumento: searchNumeroDocumento ? sanitizeSearchParam(searchNumeroDocumento) : null,
    searchProjeto: searchProjeto ? sanitizeSearchParam(searchProjeto) : null,
    searchMatriz: searchMatriz ? sanitizeSearchParam(searchMatriz) : null,
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
    skipCount: !hasFilters,
    searchFornecedor: hasFilters && searchFornecedor ? sanitizeSearchParam(searchFornecedor) : null,
    searchStatus: hasFilters && (searchStatus && searchStatus !== 'all') ? searchStatus : null,
    searchNumeroDocumento: hasFilters && searchNumeroDocumento ? sanitizeSearchParam(searchNumeroDocumento) : null,
    searchProjeto: hasFilters && searchProjeto ? sanitizeSearchParam(searchProjeto) : null,
    searchMatriz: hasFilters && searchMatriz ? sanitizeSearchParam(searchMatriz) : null,
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
    setViewingConta(null);
  };

  const handleView = (conta: any) => {
    setViewingConta(conta);
    setEditingConta(conta);
    setShowForm(true);
  };

  const handleEdit = (conta: any) => {
    setViewingConta(null);
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
    if (Number(conta.titulos_pagos) > 0) {
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

  // IDs of the accounts currently shown on the page (used to fetch details in one shot)
  const currentContaIds = useMemo(
    () => sortedContasPagar.map((c: any) => c.id),
    [sortedContasPagar]
  );
  const currentContaIdsKey = currentContaIds.join(',');

  // When "Exibir dados" is active, (re)load the details for the accounts on the
  // current page — a single call for every id (no N+1). Reruns when the page or
  // the filtered result set changes.
  useEffect(() => {
    if (!exibirDados) {
      setDetalhes({});
      return;
    }
    if (currentContaIds.length === 0) {
      setDetalhes({});
      return;
    }

    let cancelled = false;
    setDetalhesLoading(true);
    loadContaPagarDetalhes({ contaIds: currentContaIds })
      .then((rows: any[]) => {
        if (cancelled) return;
        const map: Record<number, { itens: any[]; projetos: any[] }> = {};
        currentContaIds.forEach((id: number) => {
          map[id] = { itens: [], projetos: [] };
        });
        (rows || []).forEach((row: any) => {
          const bucket = map[row.conta_pagar_id] || (map[row.conta_pagar_id] = { itens: [], projetos: [] });
          if (row.tipo === 'projeto') {
            bucket.projetos.push(row);
          } else {
            bucket.itens.push(row);
          }
        });
        setDetalhes(map);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error('Error loading conta detalhes:', err);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar o detalhamento dos títulos.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setDetalhesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exibirDados, currentContaIdsKey]);

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
                <Combobox
                  value={tempSearchFornecedor}
                  onValueChange={setTempSearchFornecedor}
                  options={fornecedorOptions}
                  placeholder="Todos"
                  searchPlaceholder="Buscar fornecedor..."
                  emptyText="Nenhum fornecedor encontrado."
                />
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
                <Combobox
                  value={tempSearchProjeto}
                  onValueChange={setTempSearchProjeto}
                  options={projetoOptions}
                  placeholder="Todos"
                  searchPlaceholder="Buscar projeto..."
                  emptyText="Nenhum projeto encontrado."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Matriz</label>
                <Combobox
                  value={tempSearchMatriz}
                  onValueChange={setTempSearchMatriz}
                  options={matrizOptions}
                  placeholder="Todos"
                  searchPlaceholder="Buscar matriz..."
                  emptyText="Nenhuma matriz encontrada."
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
              <Button
                variant={exibirDados ? 'default' : 'outline'}
                onClick={() => setExibirDados((v) => !v)}
              >
                <List className="h-4 w-4 mr-2" />
                Exibir dados
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
          <Table className="min-w-[900px]">
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
                  onClick={() => handleSort('fornecedor_nome')}
                >
                  <div className="flex items-center">
                    Fornecedor
                    {getSortIcon('fornecedor_nome')}
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
                <TableHead className="w-[120px] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContasPagar.map((conta: any) => (
                <Fragment key={conta.id}>
                <TableRow className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className="px-4 py-3.5 align-middle text-sm text-slate-600">
                    {conta.matriz_nome || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle font-mono text-sm font-semibold text-slate-700">
                    {conta.numero_documento}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 align-middle">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">
                        {conta.fornecedor_nome}
                      </span>
                      <span className="text-xs text-slate-500">
                        {conta.matriz_nome || '-'}
                      </span>
                    </div>
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
                    <div className="flex items-center gap-2">
                      <FinanceActionButton icon={Eye} onClick={() => handleView(conta)} title="Visualizar" tone="neutral" />
                      <FinanceActionButton icon={CreditCard} onClick={() => handlePayment(conta)} title="Baixar/Pagar" tone="success" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white p-0 text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(conta)} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4 text-sky-600" />
                            Editar
                          </DropdownMenuItem>
                          {Number(conta.titulos_pagos) > 0 && (
                            <DropdownMenuItem onClick={() => handleReverse(conta)} className="cursor-pointer">
                              <Undo2 className="mr-2 h-4 w-4 text-amber-600" />
                              Estornar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                {exibirDados && (
                  <TableRow className="border-b border-slate-100 bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={7} className="px-6 py-3">
                      {detalhesLoading && !detalhes[conta.id] ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando detalhamento...
                        </div>
                      ) : (
                        (() => {
                          const det = detalhes[conta.id];
                          const itens = det?.itens || [];
                          const projetos = det?.projetos || [];
                          return (
                            <div className="space-y-1.5">
                              {itens.length === 0 ? (
                                <div className="text-xs italic text-muted-foreground">
                                  Sem produtos vinculados
                                </div>
                              ) : (
                                itens.map((item: any, i: number) => (
                                  <div key={i} className="text-xs text-slate-600">
                                    <span className="font-medium text-slate-700">Produto:</span> {item.produto_nome || '-'}
                                    {' · '}
                                    <span className="font-medium text-slate-700">Grupo:</span> {item.grupo_nome || '-'}
                                    {' · '}
                                    <span className="font-medium text-slate-700">Subgrupo:</span> {item.subgrupo_nome || '-'}
                                    {' · '}
                                    <span className="font-medium text-slate-700">Valor:</span> {formatCurrency(parseFloat(item.valor_total) || 0)}
                                  </div>
                                ))
                              )}
                              {projetos.length > 0 && (
                                <div className="pt-0.5 text-xs text-slate-600">
                                  <span className="font-medium text-slate-700">Projeto(s):</span>{' '}
                                  {projetos.map((p: any) => p.projeto_nome).filter(Boolean).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))}
              {sortedContasPagar.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center">
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

interface ReversePaymentModalContentProps {
  conta: any;
  onClose: () => void;
  onSuccess: () => void;
}
