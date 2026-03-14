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
      <ListingPageHeader
        title="Cadastrar Sócio"
        description="Gerencie os sócios com o mesmo padrão clean e corporativo das demais listagens."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Sócio
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
                <TableHead className={listingTableHeadClassName}>Email</TableHead>
                <TableHead className={listingTableHeadClassName}>Telefone</TableHead>
                <TableHead className={listingTableHeadClassName}>CPF</TableHead>
                <TableHead className={listingTableHeadClassName}>Data Nascimento</TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {socios?.map((socio: any) => (
                <TableRow key={socio.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                    {socio.nome}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    {socio.email || '-'}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    {socio.telefone || '-'}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    {socio.cpf || '-'}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    {socio.data_nascimento ? new Date(socio.data_nascimento).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-right`}>
                    <div className="flex justify-end gap-2">
                      <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(socio)} tone="brand" />
                      <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(socio)} tone="danger" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {socios?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="px-4">
                    <ListingEmptyState
                      icon={User}
                      title="Nenhum sócio cadastrado"
                      description="Comece criando seu primeiro sócio."
                      action={
                        <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar primeiro sócio
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
