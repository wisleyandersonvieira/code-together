/* ClienteList */ 'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, FileText, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import loadClientesAction from '@/actions/loadClientes';
import deleteClienteAction from '@/actions/deleteCliente';
import checkClienteCanDeleteAction from '@/actions/checkClienteCanDelete';
import { ClienteForm } from './ClienteForm';
import {
  FinanceActionButton,
  FinanceStatusBadge,
  ListingEmptyState,
  ListingFilterBadge,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';

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
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <ListingPageHeader
            title="Clientes"
            description="Gerencie os cadastros de clientes com a mesma experiência visual das áreas financeiras."
            action={
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} className={listingPrimaryButtonClassName}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
              <ClienteForm
                cliente={selectedCliente || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
                modalMode={true}
              />
            </DialogContent>
          </Dialog>
            }
          />
        </CardHeader>
        <CardContent className="space-y-6 px-0">
          <div className="space-y-4">
            <ListingFilterCard>
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Buscar por Nome
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Digite parte do nome do cliente..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={`pl-10 ${listingFilterFieldClassName}`}
                  />
                </div>
              </div>
              
              <div className="flex items-end gap-2">
                <Button onClick={handleSearch} className={listingPrimaryButtonClassName}>
                  <Search className="h-4 w-4" />
                  Filtrar
                </Button>
                
                {appliedSearch && (
                  <Button 
                    variant="outline" 
                    onClick={handleClearSearch}
                    className={listingSecondaryButtonClassName}
                  >
                    <X className="h-4 w-4" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            </ListingFilterCard>

            {appliedSearch && (
              <div className="flex flex-wrap gap-2">
                <ListingFilterBadge>
                  Busca: "{appliedSearch}"
                </ListingFilterBadge>
              </div>
            )}

            {clientes.length === 0 ? (
              <ListingTableCard>
                <CardContent className="p-0">
                  <ListingEmptyState
                    icon={FileText}
                    title={appliedSearch ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                    description={
                      appliedSearch
                        ? 'Nenhum cliente encontrado com o filtro aplicado.'
                        : 'Clique em "Novo Cliente" para começar.'
                    }
                  />
                </CardContent>
              </ListingTableCard>
            ) : (
            <ListingTableCard>
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                    <TableHead className={listingTableHeadClassName}>Status</TableHead>
                    <TableHead className={listingTableHeadClassName}>Email</TableHead>
                    <TableHead className={listingTableHeadClassName}>Telefone</TableHead>
                    <TableHead className={listingTableHeadClassName}>CPF</TableHead>
                    <TableHead className={listingTableHeadClassName}>Data Nasc.</TableHead>
                    <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente: Cliente) => (
                    <TableRow key={cliente.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={`${listingTableCellClassName} font-medium text-slate-700`}>{cliente.name}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        {cliente.active ? (
                          <FinanceStatusBadge label="Ativo" tone="success" />
                        ) : (
                          <FinanceStatusBadge label="Inativo" tone="neutral" />
                        )}
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{cliente.email || '-'}</TableCell>
                      <TableCell className={listingTableCellClassName}>{cliente.phone || '-'}</TableCell>
                      <TableCell className={`${listingTableCellClassName} font-mono`}>{cliente.cpf || '-'}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        {cliente.birth_date
                          ? new Date(cliente.birth_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell className={`${listingTableCellClassName} text-right`}>
                        <div className="flex justify-end gap-2">
                          <FinanceActionButton icon={Pencil} onClick={() => handleEdit(cliente)} title="Editar" tone="brand" />
                          <FinanceActionButton
                            icon={Trash2}
                            onClick={() => handleDelete(cliente.id, cliente.name)}
                            title="Excluir"
                            tone="danger"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ListingTableCard>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
