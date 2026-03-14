'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Building } from 'lucide-react';
import { MatrizesForm } from './MatrizesForm';
import { useToast } from '@/hooks/use-toast';
import loadMatrizesAction from '@/actions/loadMatrizes';
import deleteMatrizAction from '@/actions/deleteMatriz';
import {
  FinanceActionButton,
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingPrimaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';

export function MatrizesList() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingMatriz, setEditingMatriz] = useState<any>(null);
  const [searchNome, setSearchNome] = useState('');

  // Data loading
  const [matrizes, loading, error, refreshMatrizes] = useLoadAction(loadMatrizesAction, [], {
    searchNome: searchNome || null,
  });

  // Mutations
  const [deleteMatriz] = useMutateAction(deleteMatrizAction);

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingMatriz(null);
    refreshMatrizes();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingMatriz(null);
  };

  const handleEdit = (matriz: any) => {
    setEditingMatriz(matriz);
    setShowForm(true);
  };

  const handleDelete = async (matriz: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir a matriz ${matriz.nome}?`)) {
      return;
    }

    try {
      await deleteMatriz({ id: matriz.id });
      toast({
        title: "Matriz excluída",
        description: "Matriz foi excluída com sucesso.",
      });
      refreshMatrizes();
    } catch (error) {
      console.error('Error deleting matriz:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a matriz.",
        variant: "destructive",
      });
    }
  };

  if (showForm) {
    return (
      <MatrizesForm
        matriz={editingMatriz}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando matrizes...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar matrizes: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Cadastrar Matriz"
        description="Gerencie matrizes e composições societárias com a mesma linguagem visual premium do sistema."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Matriz
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome..."
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              className={`${listingFilterFieldClassName} pl-10`}
            />
          </div>
        </div>
      </ListingFilterCard>

      <ListingTableCard>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                <TableHead className={listingTableHeadClassName}>CNPJ/EIN</TableHead>
                <TableHead className={listingTableHeadClassName}>Endereço</TableHead>
                <TableHead className={listingTableHeadClassName}>Sócios</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrizes?.map((matriz: any) => (
                <TableRow key={matriz.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                    {matriz.nome}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    {matriz.cnpj_ein || '-'}
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} max-w-[220px] truncate`} title={matriz.endereco}>
                    {matriz.endereco || '-'}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    {matriz.total_socios} sócio(s)
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-right`}>
                    <div className="flex justify-end gap-2">
                      <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(matriz)} tone="brand" />
                      <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(matriz)} tone="danger" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {matrizes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="px-4">
                    <ListingEmptyState
                      icon={Building}
                      title="Nenhuma matriz cadastrada"
                      description="Comece criando sua primeira matriz."
                      action={
                        <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar primeira matriz
                        </Button>
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
