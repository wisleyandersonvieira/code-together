'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Plus, Trash2, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadEmpresasAction from '@/actions/loadEmpresas';
import loadClientesAction from '@/actions/loadClientes';
import checkEmpresaCanDeleteAction from '@/actions/checkEmpresaCanDelete';
import deleteEmpresaAction from '@/actions/deleteEmpresa';
import { EmpresaForm } from './EmpresaForm';

interface Empresa {
  id: number;
  name: string;
  number?: string;
  file_urls?: string[];
  created_at: string;
  clientes: Array<{
    cliente_id: number;
    cliente_name: string;
    percentage: number;
  }>;
}

export function EmpresaList() {
  const { toast } = useToast();
  const [selectedClienteId, setSelectedClienteId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [empresas, loading, error, refresh] = useLoadAction(
    loadEmpresasAction, 
    [], 
    { 
      clienteId: selectedClienteId === 'all' ? null : selectedClienteId, 
      searchTerm: searchTerm || null 
    }
  );
  const [clientes] = useLoadAction(loadClientesAction, []);
  const [checkCanDelete] = useMutateAction(checkEmpresaCanDeleteAction);
  const [deleteEmpresa, isDeleting] = useMutateAction(deleteEmpresaAction);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleEdit = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedEmpresa(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedEmpresa(null);
    refresh();
  };

  const handleClearFilters = () => {
    setSelectedClienteId('all');
    setSearchTerm('');
  };

  const hasActiveFilters = (selectedClienteId !== 'all') || searchTerm;

  const handleDelete = async (empresa: Empresa) => {
    try {
      // Check if empresa can be deleted
      const checkResult = await checkCanDelete({ empresaId: empresa.id });
      const canDelete = checkResult.find((r: any) => r.table_name === 'summary')?.can_delete;
      
      if (!canDelete) {
        const relationships = checkResult.filter((r: any) => r.table_name !== 'summary' && r.count > 0);
        const relationshipMessages = relationships.map((r: any) => {
          switch (r.table_name) {
            case 'projetos_direto': return `${r.count} projeto(s) diretamente`;
            case 'projetos_via_grupo': return `${r.count} projeto(s) via grupos`;
            case 'contas_pagar': return `${r.count} conta(s) a pagar`;
            case 'contas_receber': return `${r.count} conta(s) a receber`;
            default: return `${r.count} registro(s) em ${r.table_name}`;
          }
        });
        
        toast({
          description: `Não é possível excluir esta empresa. Ela possui vínculos com: ${relationshipMessages.join(', ')}.`,
          variant: 'destructive',
        });
        return;
      }

      // Show confirmation dialog
      const confirmDelete = window.confirm(
        `Tem certeza que deseja excluir a empresa "${empresa.name}"? Esta ação não pode ser desfeita.`
      );
      
      if (!confirmDelete) return;

      await deleteEmpresa({ id: empresa.id });
      
      toast({
        description: 'Empresa excluída com sucesso!',
      });
      
      refresh();
    } catch (error) {
      toast({
        description: 'Erro ao excluir empresa. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando empresas...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar empresas</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Lista de Empresas Clientes</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isEditMode ? 'Editar Empresa' : 'Criar Nova Empresa'}
                </DialogTitle>
              </DialogHeader>
              <EmpresaForm
                empresa={selectedEmpresa || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Filtrar por Cliente
                </label>
                <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clientes.map((cliente: any) => (
                      <SelectItem key={cliente.id} value={cliente.id.toString()}>
                        {cliente.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Buscar por Nome
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Digite o nome da empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleClearFilters}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>

            {/* Indicador de filtros ativos */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {selectedClienteId !== 'all' && (
                  <Badge variant="secondary">
                    Cliente: {clientes.find((c: any) => c.id.toString() === selectedClienteId)?.name}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="secondary">
                    Busca: "{searchTerm}"
                  </Badge>
                )}
              </div>
            )}
            {empresas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {hasActiveFilters 
                  ? "Nenhuma empresa encontrada com os filtros aplicados."
                  : "Nenhuma empresa encontrada. Clique em \"Nova Empresa\" para começar."
                }
              </div>
            ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Clientes</TableHead>
                    <TableHead>Participação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa: Empresa) => {
                    const totalPercentage = empresa.clientes.reduce((sum, c) => sum + c.percentage, 0);
                    
                    return (
                      <TableRow key={empresa.id}>
                        <TableCell className="font-medium">{empresa.name}</TableCell>
                        <TableCell>{empresa.number || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {empresa.clientes.map((cliente, idx) => (
                              <div key={idx} className="text-sm">
                                {cliente.cliente_name}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {empresa.clientes.map((cliente, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {cliente.percentage}%
                              </Badge>
                            ))}
                            <div className="text-xs text-muted-foreground">
                              Total: {totalPercentage.toFixed(2)}%
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(empresa)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDelete(empresa)}
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
          </div>
        </CardContent>
      </Card>
    </>
  );
}
