/* ClienteList */ 'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, FileText, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import loadClientesAction from '@/actions/loadClientes';
import deleteClienteAction from '@/actions/deleteCliente';
import checkClienteCanDeleteAction from '@/actions/checkClienteCanDelete';
import { ClienteForm } from './ClienteForm';

interface Cliente {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  file_urls?: string[];
  has_documents?: boolean;
  active?: boolean;
  created_at: string;
  updated_at: string;
}

export function ClienteList() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [clientes, loading, error, refresh] = useLoadAction(
    loadClientesAction, 
    [], 
    { searchTerm: appliedSearch || null }
  );
  const [deleteCliente, isDeleting] = useMutateAction(deleteClienteAction);
  const [checkCanDelete] = useMutateAction(checkClienteCanDeleteAction);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedCliente(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      const canDeleteResult = await checkCanDelete({ clienteId: id });
      const summary = canDeleteResult.find((r: any) => r.table_name === 'summary');
      
      if (!summary?.can_delete) {
        const relationships = canDeleteResult.filter((r: any) => r.table_name !== 'summary');
        const relationshipMessages = relationships.map((r: any) => {
          switch (r.table_name) {
            case 'contas_receber':
              return `${r.count} conta(s) a receber`;
            case 'projetos_direto':
              return `${r.count} projeto(s) direto(s)`;
            case 'projetos_via_empresa':
              return `Projetos via empresa`;
            case 'projetos_via_grupo':
              return `Projetos via grupo`;
            default:
              return `${r.table_name}: ${r.count}`;
          }
        }).join(', ');
        
        toast({
          description: `Não é possível excluir "${name}". Cliente possui vínculos: ${relationshipMessages}`,
          variant: 'destructive',
        });
        return;
      }

      if (confirm(`Tem certeza que deseja excluir o cliente "${name}"?`)) {
        await deleteCliente({ id });
        toast({ description: 'Cliente excluído com sucesso!' });
        refresh();
      }
    } catch (error) {
      toast({
        description: 'Erro ao verificar vínculos do cliente.',
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedCliente(null);
    refresh();
  };

  const handleSearch = () => {
    setAppliedSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando clientes...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar clientes</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Lista de Clientes</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isEditMode ? 'Editar Cliente' : 'Criar Novo Cliente'}
                </DialogTitle>
              </DialogHeader>
              <ClienteForm
                cliente={selectedCliente || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
                modalMode={true}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Campo de busca */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Buscar por Nome
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Digite parte do nome do cliente..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex items-end gap-2">
                <Button onClick={handleSearch} className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Filtrar
                </Button>
                
                {appliedSearch && (
                  <Button 
                    variant="outline" 
                    onClick={handleClearSearch}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Indicador de filtro ativo */}
            {appliedSearch && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Busca: "{appliedSearch}"
                </Badge>
              </div>
            )}

            {clientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {appliedSearch 
                  ? "Nenhum cliente encontrado com o filtro aplicado."
                  : "Nenhum cliente encontrado. Clique em \"Novo Cliente\" para começar."
                }
              </div>
            ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Data Nasc.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente: Cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.name}</TableCell>
                      <TableCell>
                        <Badge variant={cliente.active ? 'default' : 'secondary'}>
                          {cliente.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>{cliente.email || '-'}</TableCell>
                      <TableCell>{cliente.phone || '-'}</TableCell>
                      <TableCell>{cliente.cpf || '-'}</TableCell>
                      <TableCell>
                        {cliente.birth_date
                          ? new Date(cliente.birth_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(cliente.id, cliente.name)}
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
          </div>
        </CardContent>
      </Card>
    </>
  );
}
