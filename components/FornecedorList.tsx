'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Eye, Edit, Trash2, Search, X } from 'lucide-react';
import loadFornecedoresAction from '@/actions/loadFornecedores';
import checkFornecedorCanDeleteAction from '@/actions/checkFornecedorCanDelete';
import deleteFornecedorAction from '@/actions/deleteFornecedor';
import { FornecedorForm } from './FornecedorForm';
import { FornecedorViewDialog } from './FornecedorViewDialog';
import { FornecedorEditDialog } from './FornecedorEditDialog';
import { useToast } from '@/hooks/use-toast';
import {
  FinanceActionButton,
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

interface Fornecedor {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  contact_phone?: string;
  ein_number?: string;
  created_at?: string;
  updated_at?: string;
}

export function FornecedorList() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [fornecedores, loading, error, refresh] = useLoadAction(
    loadFornecedoresAction, 
    [], 
    { searchTerm: appliedSearch || null }
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [checkCanDelete] = useMutateAction(checkFornecedorCanDeleteAction);
  const [deleteFornecedor, isDeleting] = useMutateAction(deleteFornecedorAction);

  const handleFormSuccess = () => {
    setIsFormOpen(false);
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

  const handleView = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setIsViewOpen(true);
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setIsEditOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setSelectedFornecedor(null);
    refresh();
  };

  const handleDelete = async (fornecedor: Fornecedor) => {
    try {
      const canDeleteResult = await checkCanDelete({ id: fornecedor.id });
      const { total_count } = canDeleteResult[0];
      
      if (total_count > 0) {
        toast({
          description: 'Este fornecedor não pode ser excluído pois possui vínculos com contas a pagar ou orçamentos.',
          variant: 'destructive',
        });
        return;
      }

      await deleteFornecedor({ id: fornecedor.id });
      toast({ description: 'Fornecedor excluído com sucesso!' });
      refresh();
    } catch (error) {
      toast({
        description: 'Erro ao excluir fornecedor. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando fornecedores...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar fornecedores</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <ListingPageHeader
          title="Fornecedores"
          description="Mantenha sua base de fornecedores com o mesmo padrão premium das listagens financeiras."
          action={
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className={listingPrimaryButtonClassName}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Fornecedor</DialogTitle>
                </DialogHeader>
                <FornecedorForm
                  onSuccess={handleFormSuccess}
                  onCancel={() => setIsFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          }
        />

        <ListingFilterCard>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Buscar por Nome
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Digite o nome do fornecedor..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={`${listingFilterFieldClassName} pl-10`}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSearch} className={listingPrimaryButtonClassName}>
                  <Search className="mr-2 h-4 w-4" />
                  Filtrar
                </Button>
                
                {appliedSearch && (
                  <Button onClick={handleClearSearch} className={listingSecondaryButtonClassName}>
                    <X className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {appliedSearch && (
              <div className="flex flex-wrap gap-2">
                <ListingFilterBadge>
                  Busca: "{appliedSearch}"
                </ListingFilterBadge>
              </div>
            )}
          </div>
        </ListingFilterCard>

        <ListingTableCard>
          <CardContent className="p-0">
            {fornecedores.length === 0 ? (
              <ListingEmptyState
                icon={Plus}
                title="Nenhum fornecedor encontrado"
                description={
                  appliedSearch 
                    ? "Nenhum fornecedor encontrado com o filtro aplicado."
                    : 'Clique em "Novo Fornecedor" para começar.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                      <TableHead className={listingTableHeadClassName}>Email</TableHead>
                      <TableHead className={listingTableHeadClassName}>Telefone</TableHead>
                      <TableHead className={listingTableHeadClassName}>EIN Number</TableHead>
                      <TableHead className={listingTableHeadClassName}>Contato</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fornecedores.map((fornecedor: Fornecedor) => (
                      <TableRow key={fornecedor.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{fornecedor.name}</TableCell>
                        <TableCell className={listingTableCellClassName}>{fornecedor.email || '-'}</TableCell>
                        <TableCell className={listingTableCellClassName}>{fornecedor.phone || '-'}</TableCell>
                        <TableCell className={listingTableCellClassName}>{fornecedor.ein_number || '-'}</TableCell>
                        <TableCell className={listingTableCellClassName}>
                          {fornecedor.contact_name ? (
                            <div>
                              <div className="font-medium text-slate-800">{fornecedor.contact_name}</div>
                              <div className="text-xs text-slate-500">{fornecedor.contact_phone}</div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className={`${listingTableCellClassName} text-right`}>
                          <div className="flex items-center justify-end gap-2">
                            <FinanceActionButton icon={Eye} title="Visualizar" onClick={() => handleView(fornecedor)} />
                            <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(fornecedor)} tone="brand" />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <span>
                                  <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => {}} tone="danger" />
                                </span>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir fornecedor</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o fornecedor "{fornecedor.name}"? 
                                    Esta ação não pode ser desfeita e só será permitida se não houver vínculos com contas a pagar ou orçamentos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(fornecedor)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

      <FornecedorViewDialog
        fornecedor={selectedFornecedor as any}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />

      <FornecedorEditDialog
        fornecedor={selectedFornecedor as any}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
