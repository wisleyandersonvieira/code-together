'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadUsersAction from '@/actions/loadUsers';
import deleteUserAction from '@/actions/deleteUser';
import { UserForm } from './UserForm';
import { UserApprovalCard } from './UserApprovalCard';
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

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function UserList() {
  const { toast } = useToast();
  const [users, loading, error, refresh] = useLoadAction(loadUsersAction, []);
  const [deleteUser, isDeleting] = useMutateAction(deleteUserAction);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await deleteUser({ id });
        toast({
          description: 'Usuário excluído com sucesso!',
        });
        refresh();
      } catch (error) {
        toast({
          description: 'Erro ao excluir usuário.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    refresh();
  };

  const handleApprovalAction = () => {
    refresh();
  };

  const pendingUsers = users.filter((user: User) => user.status === 'pending');
  const activeUsers = users.filter((user: User) => user.status !== 'pending');

  const getStatusBadge = (status: string) => {
    const labels = {
      active: 'Ativo',
      inactive: 'Inativo', 
      pending: 'Pendente',
    };

    const tones = {
      active: 'success',
      inactive: 'neutral',
      pending: 'warning',
    } as const;

    return (
      <FinanceStatusBadge
        label={labels[status as keyof typeof labels] || status}
        tone={tones[status as keyof typeof tones] || 'neutral'}
      />
    );
  };

  const getRoleBadge = (role: string) => {
    const labels = {
      admin: 'Administrador',
      manager: 'Gerente',
      user: 'Usuário',
    };

    return labels[role as keyof typeof labels] || role;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando usuários...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar usuários</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pendingUsers.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-200/80 bg-slate-50/70">
            <CardTitle className="flex items-center text-xl text-slate-900">
              <UserCheck className="mr-2 h-5 w-5 text-orange-600" />
              Usuários Pendentes de Aprovação ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingUsers.map((user: User) => (
                <UserApprovalCard
                  key={user.id}
                  user={user}
                  onApproved={handleApprovalAction}
                  onRejected={handleApprovalAction}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ListingPageHeader
        title="Usuários"
        description="Administre acessos e permissões com a mesma estrutura visual aplicada ao financeiro."
        action={
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button className={listingPrimaryButtonClassName} onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isEditMode ? 'Editar Usuário' : 'Criar Novo Usuário'}
                </DialogTitle>
              </DialogHeader>
              <UserForm
                user={selectedUser || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
                isAdminView={true}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <ListingTableCard>
        <CardContent className="p-0">
          {activeUsers.length === 0 ? (
            <ListingEmptyState
              icon={Plus}
              title="Nenhum usuário ativo encontrado"
              description='Clique em "Novo Usuário" para começar.'
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                    <TableHead className={listingTableHeadClassName}>Email</TableHead>
                    <TableHead className={listingTableHeadClassName}>Telefone</TableHead>
                    <TableHead className={listingTableHeadClassName}>Papel</TableHead>
                    <TableHead className={listingTableHeadClassName}>Status</TableHead>
                    <TableHead className={listingTableHeadClassName}>Data de Criação</TableHead>
                    <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map((user: User) => (
                    <TableRow key={user.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{user.name}</TableCell>
                      <TableCell className={listingTableCellClassName}>{user.email}</TableCell>
                      <TableCell className={listingTableCellClassName}>{user.phone || '-'}</TableCell>
                      <TableCell className={listingTableCellClassName}>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className={listingTableCellClassName}>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className={`${listingTableCellClassName} text-right`}>
                        <div className="flex justify-end gap-2">
                          <FinanceActionButton
                            icon={Pencil}
                            title="Editar"
                            onClick={() => handleEdit(user)}
                            tone="brand"
                          />
                          <FinanceActionButton
                            icon={Trash2}
                            title="Excluir"
                            onClick={() => handleDelete(user.id)}
                            tone="danger"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </ListingTableCard>
    </div>
  );
}
