'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadGruposAction from '@/actions/loadGrupos';
import checkGrupoCanDeleteAction from '@/actions/checkGrupoCanDelete';
import deleteGrupoAction from '@/actions/deleteGrupo';
import { GrupoForm } from './GrupoForm';
import {
  FinanceActionButton,
  FinanceStatusBadge,
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';

interface Grupo {
  id: number;
  name: string;
  file_urls?: string[];
  created_at: string;
  members: Array<{
    cliente_id?: number;
    empresa_id?: number;
    cliente_name?: string;
    empresa_name?: string;
    percentage: number;
  }>;
}

export function GrupoList() {
  const { toast } = useToast();
  const [grupos, loading, error, refresh] = useLoadAction(loadGruposAction, []);
  const [checkCanDelete] = useMutateAction(checkGrupoCanDeleteAction);
  const [deleteGrupo, isDeleting] = useMutateAction(deleteGrupoAction);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleEdit = (grupo: Grupo) => {
    setSelectedGrupo(grupo);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedGrupo(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedGrupo(null);
    refresh();
  };

  const handleDelete = async (grupo: Grupo) => {
    try {
      // Check if grupo can be deleted
      const checkResult = await checkCanDelete({ grupoId: grupo.id });
      const canDelete = checkResult.find((r: any) => r.table_name === 'summary')?.can_delete;
      
      if (!canDelete) {
        const relationships = checkResult.filter((r: any) => r.table_name !== 'summary' && r.count > 0);
        const relationshipMessages = relationships.map((r: any) => {
          switch (r.table_name) {
            case 'projetos_direto': return `${r.count} projeto(s) diretamente`;
            case 'contas_pagar': return `${r.count} conta(s) a pagar`;
            case 'contas_receber': return `${r.count} conta(s) a receber`;
            default: return `${r.count} registro(s) em ${r.table_name}`;
          }
        });
        
        toast({
          description: `Não é possível excluir este grupo. Ele possui vínculos com: ${relationshipMessages.join(', ')}.`,
          variant: 'destructive',
        });
        return;
      }

      // Show confirmation dialog
      const confirmDelete = window.confirm(
        `Tem certeza que deseja excluir o grupo "${grupo.name}"? Esta ação não pode ser desfeita.`
      );
      
      if (!confirmDelete) return;

      await deleteGrupo({ id: grupo.id });
      
      toast({
        description: 'Grupo excluído com sucesso!',
      });
      
      refresh();
    } catch (error) {
      toast({
        description: 'Erro ao excluir grupo. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando grupos...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar grupos</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <ListingPageHeader
          title="Grupos"
          description="Gerencie grupos de clientes com o mesmo padrão visual das listagens financeiras."
          action={
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className={listingPrimaryButtonClassName} onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Grupo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {isEditMode ? 'Editar Grupo' : 'Criar Novo Grupo'}
                  </DialogTitle>
                </DialogHeader>
                <GrupoForm
                  grupo={selectedGrupo || undefined}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setIsFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          }
        />

        <ListingTableCard>
          <CardContent className="p-0">
            {grupos.length === 0 ? (
              <ListingEmptyState
                icon={Plus}
                title="Nenhum grupo encontrado"
                description='Clique em "Novo Grupo" para começar.'
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                      <TableHead className={listingTableHeadClassName}>Membros</TableHead>
                      <TableHead className={listingTableHeadClassName}>Participação</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((grupo: Grupo) => {
                      const totalPercentage = grupo.members.reduce((sum, m) => sum + m.percentage, 0);
                      
                      return (
                        <TableRow key={grupo.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                          <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{grupo.name}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="space-y-1">
                              {grupo.members.map((member, idx) => (
                                <div key={idx} className="text-sm text-slate-700">
                                  {member.cliente_name || member.empresa_name}
                                  <span className="ml-2 text-xs text-slate-500">
                                    ({member.cliente_name ? 'Cliente' : 'Empresa'})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="flex flex-wrap gap-2">
                              {grupo.members.map((member, idx) => (
                                <FinanceStatusBadge key={idx} label={`${member.percentage}%`} tone="neutral" />
                              ))}
                              <span className="text-xs font-medium text-slate-500">
                                Total: {totalPercentage.toFixed(2)}%
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className={`${listingTableCellClassName} text-right`}>
                            <div className="flex justify-end gap-2">
                              <FinanceActionButton icon={Pencil} title="Editar" onClick={() => handleEdit(grupo)} tone="brand" />
                              <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(grupo)} tone="danger" />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </ListingTableCard>
      </div>
    </>
  );
}
