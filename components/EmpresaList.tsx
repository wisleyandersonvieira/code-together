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
      <div className="space-y-6">
        <ListingPageHeader
          title="Empresas"
          description="Gerencie empresas clientes com a mesma estrutura visual das listagens financeiras."
          action={
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className={listingPrimaryButtonClassName} onClick={handleCreate}>
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
          }
        />

        <ListingFilterCard>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Filtrar por Cliente
                </label>
                <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                  <SelectTrigger className={listingFilterFieldClassName}>
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
              
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Buscar por Nome
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Digite o nome da empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${listingFilterFieldClassName} pl-10`}
                  />
                </div>
              </div>
              
              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button onClick={handleClearFilters} className={listingSecondaryButtonClassName}>
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {selectedClienteId !== 'all' && (
                  <ListingFilterBadge>
                    Cliente: {clientes.find((c: any) => c.id.toString() === selectedClienteId)?.name}
                  </ListingFilterBadge>
                )}
                {searchTerm && (
                  <ListingFilterBadge>
                    Busca: "{searchTerm}"
                  </ListingFilterBadge>
                )}
              </div>
            )}
          </div>
        </ListingFilterCard>

        <ListingTableCard>
          <CardContent className="p-0">
            {empresas.length === 0 ? (
              <ListingEmptyState
                icon={Plus}
                title="Nenhuma empresa encontrada"
                description={
                  hasActiveFilters 
                    ? "Nenhuma empresa encontrada com os filtros aplicados."
                    : 'Clique em "Nova Empresa" para começar.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                      <TableHead className={listingTableHeadClassName}>Número</TableHead>
                      <TableHead className={listingTableHeadClassName}>Clientes</TableHead>
                      <TableHead className={listingTableHeadClassName}>Participação</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas.map((empresa: Empresa) => {
                      const totalPercentage = empresa.clientes.reduce((sum, c) => sum + c.percentage, 0);
                      
                      return (
                        <TableRow key={empresa.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                          <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{empresa.name}</TableCell>
                          <TableCell className={listingTableCellClassName}>{empresa.number || '-'}</TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="space-y-1">
                              {empresa.clientes.map((cliente, idx) => (
                                <div key={idx} className="text-sm text-slate-700">
                                  {cliente.cliente_name}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-2">
                                {empresa.clientes.map((cliente, idx) => (
                                  <FinanceStatusBadge key={idx} label={`${cliente.percentage}%`} tone="neutral" />
                                ))}
                              </div>
                              <div className="text-xs font-medium text-slate-500">
                                Total: {totalPercentage.toFixed(2)}%
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className={`${listingTableCellClassName} text-right`}>
                            <div className="flex justify-end gap-2">
                              <FinanceActionButton icon={Pencil} title="Editar" onClick={() => handleEdit(empresa)} tone="brand" />
                              <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(empresa)} tone="danger" />
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
