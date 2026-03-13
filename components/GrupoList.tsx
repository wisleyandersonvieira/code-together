'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadGruposAction from '@/actions/loadGrupos';
import checkGrupoCanDeleteAction from '@/actions/checkGrupoCanDelete';
import deleteGrupoAction from '@/actions/deleteGrupo';
import { GrupoForm } from './GrupoForm';

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Lista de Grupos de Clientes</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
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
        </CardHeader>
        <CardContent>
          {grupos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum grupo encontrado. Clique em "Novo Grupo" para começar.
            </div>
          ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Participação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((grupo: Grupo) => {
                  const totalPercentage = grupo.members.reduce((sum, m) => sum + m.percentage, 0);
                  
                  return (
                    <TableRow key={grupo.id}>
                      <TableCell className="font-medium">{grupo.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {grupo.members.map((member, idx) => (
                            <div key={idx} className="text-sm">
                              {member.cliente_name || member.empresa_name}
                              <span className="text-muted-foreground ml-2">
                                ({member.cliente_name ? 'Cliente' : 'Empresa'})
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {grupo.members.map((member, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {member.percentage}%
                            </Badge>
                          ))}
                          <div className="text-xs text-muted-foreground">
                            Total: {totalPercentage.toFixed(2)}%
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(grupo)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDelete(grupo)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
      </Card>
    </>
  );
}
