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

interface Fornecedor {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  contact_phone?: string;
  ein_number?: string;
  created_at: string;
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Lista de Fornecedores</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button>
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
                    placeholder="Digite o nome do fornecedor..."
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

            {fornecedores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {appliedSearch 
                  ? "Nenhum fornecedor encontrado com o filtro aplicado."
                  : "Nenhum fornecedor encontrado. Clique em \"Novo Fornecedor\" para começar."
                }
              </div>
            ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>EIN Number</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map((fornecedor: Fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell className="font-medium">{fornecedor.name}</TableCell>
                      <TableCell>{fornecedor.email || '-'}</TableCell>
                      <TableCell>{fornecedor.phone || '-'}</TableCell>
                      <TableCell>{fornecedor.ein_number || '-'}</TableCell>
                      <TableCell>
                        {fornecedor.contact_name ? (
                          <div>
                            <div className="font-medium">{fornecedor.contact_name}</div>
                            <div className="text-sm text-muted-foreground">{fornecedor.contact_phone}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleView(fornecedor)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(fornecedor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                disabled={isDeleting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
          </div>
        </CardContent>
      </Card>

      <FornecedorViewDialog
        fornecedor={selectedFornecedor}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />

      <FornecedorEditDialog
        fornecedor={selectedFornecedor}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleEditSuccess}
      />
    </>
  );
}
