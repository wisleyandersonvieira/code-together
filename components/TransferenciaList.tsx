'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transferências</h2>
          <p className="text-muted-foreground">
            Realize transferências entre contas bancárias
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Transferência
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Filtrar por Conta
              </label>
              <Select value={selectedContaId} onValueChange={setSelectedContaId}>
                <SelectTrigger>
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

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Data Início
              </label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Data Fim
              </label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtrar
              </Button>
              
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  onClick={handleClearFilters}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Indicadores de filtros ativos */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4">
              {appliedFilters.contaId && (
                <Badge variant="secondary">
                  Conta: {contas.find((c: any) => c.id.toString() === appliedFilters.contaId)?.nome}
                </Badge>
              )}
              {appliedFilters.dataInicio && (
                <Badge variant="secondary">
                  A partir de: {new Date(appliedFilters.dataInicio).toLocaleDateString('pt-BR')}
                </Badge>
              )}
              {appliedFilters.dataFim && (
                <Badge variant="secondary">
                  Até: {new Date(appliedFilters.dataFim).toLocaleDateString('pt-BR')}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Conta Origem</TableHead>
                <TableHead className="text-center">→</TableHead>
                <TableHead>Conta Destino</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferencias?.map((transferencia: any) => (
                <TableRow key={transferencia.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {new Date(transferencia.data_transferencia).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transferencia.conta_origem_nome}</div>
                      <div className="text-sm text-muted-foreground">{transferencia.conta_origem_banco}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transferencia.conta_destino_nome}</div>
                      <div className="text-sm text-muted-foreground">{transferencia.conta_destino_banco}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {formatCurrency(parseFloat(transferencia.valor))}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={transferencia.observacoes}>
                    {transferencia.observacoes || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(transferencia)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(transferencia)}
                        title="Excluir"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!transferencias || transferencias.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <ArrowLeftRight className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        {hasActiveFilters ? 'Nenhuma transferência encontrada' : 'Nenhuma transferência cadastrada'}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {hasActiveFilters 
                          ? 'Nenhuma transferência encontrada com os filtros aplicados.'
                          : 'Comece criando sua primeira transferência entre contas.'
                        }
                      </p>
                      {!hasActiveFilters && (
                        <Button onClick={() => setShowForm(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar primeira transferência
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
