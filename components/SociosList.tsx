'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, User } from 'lucide-react';
import { SociosForm } from './SociosForm';
import { useToast } from '@/hooks/use-toast';
import loadSociosAction from '@/actions/loadSocios';
import deleteSocioAction from '@/actions/deleteSocio';

export function SociosList() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSocio, setEditingSocio] = useState<any>(null);
  const [searchNome, setSearchNome] = useState('');

  // Data loading
  const [socios, loading, error, refreshSocios] = useLoadAction(loadSociosAction, [], {
    searchNome: searchNome || null,
  });

  // Mutations
  const [deleteSocio] = useMutateAction(deleteSocioAction);

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSocio(null);
    refreshSocios();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSocio(null);
  };

  const handleEdit = (socio: any) => {
    setEditingSocio(socio);
    setShowForm(true);
  };

  const handleDelete = async (socio: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o sócio ${socio.nome}?`)) {
      return;
    }

    try {
      await deleteSocio({ id: socio.id });
      toast({
        title: "Sócio excluído",
        description: "Sócio foi excluído com sucesso.",
      });
      refreshSocios();
    } catch (error) {
      console.error('Error deleting socio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o sócio. Verifique se não está vinculado a alguma matriz.",
        variant: "destructive",
      });
    }
  };

  if (showForm) {
    return (
      <SociosForm
        socio={editingSocio}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando sócios...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar sócios: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cadastro de Sócios</h2>
          <p className="text-muted-foreground">
            Gerencie os sócios para composição das matrizes
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Sócio
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
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Data Nascimento</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {socios?.map((socio: any) => (
                <TableRow key={socio.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {socio.nome}
                  </TableCell>
                  <TableCell>
                    {socio.email || '-'}
                  </TableCell>
                  <TableCell>
                    {socio.telefone || '-'}
                  </TableCell>
                  <TableCell>
                    {socio.cpf || '-'}
                  </TableCell>
                  <TableCell>
                    {socio.data_nascimento ? new Date(socio.data_nascimento).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(socio)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(socio)}
                        title="Excluir"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {socios?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhum sócio cadastrado</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece criando seu primeiro sócio.
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeiro sócio
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
