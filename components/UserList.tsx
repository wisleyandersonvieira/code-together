'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadUsersAction from '@/actions/loadUsers';
import deleteUserAction from '@/actions/deleteUser';
import { UserForm } from './UserForm';
import { UserApprovalCard } from './UserApprovalCard';

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
    const variants = {
      active: 'default',
      inactive: 'secondary',
      pending: 'outline',
    } as const;
    
    const labels = {
      active: 'Ativo',
      inactive: 'Inativo', 
      pending: 'Pendente',
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
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
      {/* Seção de Aprovações Pendentes */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
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

      {/* Lista Principal de Usuários */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Lista de Usuários</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
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
        </CardHeader>
        <CardContent>
          {activeUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário ativo encontrado. Clique em "Novo Usuário" para começar.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
