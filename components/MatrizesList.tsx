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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cadastro de Matrizes</h2>
          <p className="text-muted-foreground">
            Gerencie as matrizes e suas participações societárias
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Matriz
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchNome}
                  onChange={(e) => setSearchNome(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ/EIN</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Sócios</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrizes?.map((matriz: any) => (
                <TableRow key={matriz.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {matriz.nome}
                  </TableCell>
                  <TableCell>
                    {matriz.cnpj_ein || '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={matriz.endereco}>
                    {matriz.endereco || '-'}
                  </TableCell>
                  <TableCell>
                    {matriz.total_socios} sócio(s)
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(matriz)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(matriz)}
                        title="Excluir"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {matrizes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma matriz cadastrada</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece criando sua primeira matriz.
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeira matriz
                      </Button>
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
