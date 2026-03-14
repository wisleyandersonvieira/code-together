'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, 
  Trash2, 
  Plus,
  CreditCard
} from 'lucide-react';
import { ContaForm } from './ContaForm';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadContasAction from '@/actions/loadContas';
import deleteContaAction from '@/actions/deleteConta';
import {
  FinanceActionButton,
  FinanceStatusBadge,
  ListingEmptyState,
  ListingPageHeader,
  listingPrimaryButtonClassName,
  listingTableCardClassName,
} from '@/components/finance/listing-ui';

export function ContaList() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [contas, loading, error, refreshContas] = useLoadAction(loadContasAction, []);
  const [deleteConta] = useMutateAction(deleteContaAction);

  const handleEdit = (conta: any) => {
    setEditingConta(conta);
    setShowForm(true);
  };

  const handleDelete = async (id: number, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a conta "${nome}"?`)) {
      return;
    }

    try {
      await deleteConta({ id });
      toast({
        title: "Conta excluída",
        description: "A conta foi excluída com sucesso.",
      });
      refreshContas();
    } catch (error) {
      console.error('Error deleting conta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conta.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingConta(null);
    refreshContas();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingConta(null);
  };





  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (showForm) {
    return (
      <ContaForm
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
          <div className="text-center">Carregando contas...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar contas: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Contas"
        description="Gerencie contas bancárias em um layout leve, premium e coerente com o módulo financeiro."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {contas.map((conta: any) => {
          return (
            <Card key={conta.id} className={listingTableCardClassName}>
              <CardHeader className="border-b border-slate-200/80 bg-slate-50/70 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center text-lg font-semibold text-slate-900">
                      <CreditCard className="mr-2 h-5 w-5 text-sky-600" />
                      {conta.nome}
                    </CardTitle>
                    <p className="text-sm text-slate-500">{conta.banco}</p>
                  </div>
                  <div className="flex gap-2">
                    <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(conta)} tone="brand" />
                    <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(conta.id, conta.nome)} tone="danger" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-slate-500">Número</span>
                    <div className="font-medium text-slate-800">{conta.numero}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">Data Saldo</span>
                    <div className="font-medium text-slate-800">{formatDate(conta.data_saldo_inicial)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <span className="text-sm font-medium text-slate-600">Saldo Inicial</span>
                  <FinanceStatusBadge label={formatCurrency(conta.saldo_inicial)} tone="success" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {contas.length === 0 && (
        <Card className={listingTableCardClassName}>
          <CardContent className="p-0">
            <ListingEmptyState
              icon={CreditCard}
              title="Nenhuma conta cadastrada"
              description="Comece criando sua primeira conta corrente."
              action={
                <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeira conta
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
