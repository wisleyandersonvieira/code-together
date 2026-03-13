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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contas Correntes</h2>
          <p className="text-muted-foreground">
            Gerencie as contas bancárias da organização
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contas.map((conta: any) => {
          return (
            <Card key={conta.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-lg">
                    <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
                    {conta.nome}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(conta)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(conta.id, conta.nome)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Banco:</span>
                    <span className="font-medium">{conta.banco}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium">{conta.numero}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo Inicial:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(conta.saldo_inicial)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data Saldo:</span>
                    <span className="font-medium">{formatDate(conta.data_saldo_inicial)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {contas.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma conta cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Comece criando sua primeira conta corrente.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira conta
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
