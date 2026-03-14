'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  ArrowLeftRight, 
  Edit, 
  Trash2,
  ArrowRight,
  Search,
  X,
  Filter
} from 'lucide-react';
import { TransferenciaForm } from './TransferenciaForm';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadTransferenciasAction from '@/actions/loadTransferencias';
import loadContasAction from '@/actions/loadContas';
import deleteTransferenciaAction from '@/actions/deleteTransferencia';
import {
  FinanceActionButton,
  FinanceStatusBadge,
  ListingEmptyState,
  ListingFilterBadge,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';

export function TransferenciaList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [editingTransferencia, setEditingTransferencia] = useState<any>(null);
  
  // Filtros
  const [selectedContaId, setSelectedContaId] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    contaId: null as string | null,
    dataInicio: null as string | null,
    dataFim: null as string | null
  });

  const [transferencias, loading, error, refresh] = useLoadAction(
    loadTransferenciasAction, 
    [], 
    appliedFilters
  );
  const [contas] = useLoadAction(loadContasAction, []);
  const [deleteTransferencia] = useMutateAction(deleteTransferenciaAction);

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingTransferencia(null);
    refresh();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTransferencia(null);
  };

  const handleEdit = (transferencia: any) => {
    setEditingTransferencia(transferencia);
    setShowForm(true);
  };

  const handleDelete = async (transferencia: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir a transferência de ${formatCurrency(transferencia.valor)}?`)) {
      return;
    }

    try {
      await deleteTransferencia({ id: transferencia.id });
      toast({
        title: "Transferência excluída",
        description: "Transferência foi excluída com sucesso.",
      });
      refresh();
    } catch (error) {
      console.error('Error deleting transferencia:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a transferência.",
        variant: "destructive",
      });
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      contaId: selectedContaId === 'all' ? null : selectedContaId,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null
    });
  };

  const handleClearFilters = () => {
    setSelectedContaId('all');
    setDataInicio('');
    setDataFim('');
    setAppliedFilters({
      contaId: null,
      dataInicio: null,
      dataFim: null
    });
  };

  const hasActiveFilters = appliedFilters.contaId || appliedFilters.dataInicio || appliedFilters.dataFim;

  if (showForm) {
    return (
      <TransferenciaForm
        transferencia={editingTransferencia}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando transferências...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar transferências: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Transferências"
        description="Realize transferências entre contas bancárias com a mesma visualização financeira do sistema."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transferência
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Filtrar por Conta
              </label>
              <Select value={selectedContaId} onValueChange={setSelectedContaId}>
                <SelectTrigger className={listingFilterFieldClassName}>
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {contas.map((conta: any) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.nome} - {conta.banco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Data Início
              </label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={listingFilterFieldClassName}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Data Fim
              </label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={listingFilterFieldClassName}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} className={listingPrimaryButtonClassName}>
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              {hasActiveFilters && (
                <Button onClick={handleClearFilters} className={listingSecondaryButtonClassName}>
                  <X className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {appliedFilters.contaId && (
                <ListingFilterBadge>
                  Conta: {contas.find((c: any) => c.id.toString() === appliedFilters.contaId)?.nome}
                </ListingFilterBadge>
              )}
              {appliedFilters.dataInicio && (
                <ListingFilterBadge>
                  A partir de: {new Date(appliedFilters.dataInicio).toLocaleDateString('pt-BR')}
                </ListingFilterBadge>
              )}
              {appliedFilters.dataFim && (
                <ListingFilterBadge>
                  Até: {new Date(appliedFilters.dataFim).toLocaleDateString('pt-BR')}
                </ListingFilterBadge>
              )}
            </div>
          )}
        </div>
      </ListingFilterCard>

      <ListingTableCard>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className={listingTableHeadClassName}>Data</TableHead>
                <TableHead className={listingTableHeadClassName}>Conta Origem</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-center`}>→</TableHead>
                <TableHead className={listingTableHeadClassName}>Conta Destino</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Valor</TableHead>
                <TableHead className={listingTableHeadClassName}>Observações</TableHead>
                <TableHead className={`${listingTableHeadClassName} w-[110px] text-right`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferencias?.map((transferencia: any) => (
                <TableRow key={transferencia.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                    {new Date(transferencia.data_transferencia).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    <div>
                      <div className="font-medium text-slate-800">{transferencia.conta_origem_nome}</div>
                      <div className="text-xs text-slate-500">{transferencia.conta_origem_banco}</div>
                    </div>
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-center`}>
                    <ArrowRight className="mx-auto h-4 w-4 text-slate-400" />
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    <div>
                      <div className="font-medium text-slate-800">{transferencia.conta_destino_nome}</div>
                      <div className="text-xs text-slate-500">{transferencia.conta_destino_banco}</div>
                    </div>
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-right`}>
                    <FinanceStatusBadge
                      label={formatCurrency(parseFloat(transferencia.valor))}
                      tone="success"
                    />
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} max-w-[220px] truncate`} title={transferencia.observacoes}>
                    {transferencia.observacoes || '-'}
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-right`}>
                    <div className="flex justify-end gap-2">
                      <FinanceActionButton
                        icon={Edit}
                        title="Editar"
                        onClick={() => handleEdit(transferencia)}
                        tone="brand"
                      />
                      <FinanceActionButton
                        icon={Trash2}
                        title="Excluir"
                        onClick={() => handleDelete(transferencia)}
                        tone="danger"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!transferencias || transferencias.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="px-4">
                    <ListingEmptyState
                      icon={ArrowLeftRight}
                      title={hasActiveFilters ? 'Nenhuma transferência encontrada' : 'Nenhuma transferência cadastrada'}
                      description={
                        hasActiveFilters
                          ? 'Nenhuma transferência encontrada com os filtros aplicados.'
                          : 'Comece criando sua primeira transferência entre contas.'
                      }
                      action={
                        !hasActiveFilters ? (
                          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Criar primeira transferência
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </ListingTableCard>
    </div>
  );
}
