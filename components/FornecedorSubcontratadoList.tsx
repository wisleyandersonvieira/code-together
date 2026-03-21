'use client';

import { useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Edit, Plus, Search, ToggleLeft, Trash2, X } from 'lucide-react';

import checkFornecedorSubcontratadoCanDeleteAction from '@/actions/checkFornecedorSubcontratadoCanDelete';
import deleteFornecedorSubcontratadoAction from '@/actions/deleteFornecedorSubcontratado';
import loadFornecedoresSubcontratadosAction from '@/actions/loadFornecedoresSubcontratados';
import toggleFornecedorSubcontratadoStatusAction from '@/actions/toggleFornecedorSubcontratadoStatus';
import { FinanceActionButton, FinanceStatusBadge, ListingEmptyState, ListingFilterCard, ListingPageHeader, ListingTableCard, listingFilterFieldClassName, listingPrimaryButtonClassName, listingSecondaryButtonClassName, listingTableCellClassName, listingTableHeadClassName } from '@/components/finance/listing-ui';
import { FornecedorSubcontratadoForm } from '@/components/FornecedorSubcontratadoForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface FornecedorSubcontratadoRow {
  id: number;
  nome_razao_social: string;
  nome_fantasia?: string;
  cpf_cnpj: string;
  telefone?: string;
  email?: string;
  contato_responsavel?: string;
  observacoes?: string;
  status: 'ativo' | 'inativo';
  auditorias_vinculadas: number;
}

export function FornecedorSubcontratadoList() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [editingFornecedor, setEditingFornecedor] = useState<FornecedorSubcontratadoRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [fornecedores, loading, error, refresh] = useLoadAction(loadFornecedoresSubcontratadosAction, [], {
    searchTerm: searchInput || null,
    status: statusFilter,
  });
  const [checkDelete] = useMutateAction(checkFornecedorSubcontratadoCanDeleteAction);
  const [deleteFornecedor] = useMutateAction(deleteFornecedorSubcontratadoAction);
  const [toggleStatus] = useMutateAction(toggleFornecedorSubcontratadoStatusAction);

  const sortedFornecedores = useMemo(
    () => [...(fornecedores || [])].sort((a, b) => a.nome_razao_social.localeCompare(b.nome_razao_social, 'pt-BR')),
    [fornecedores],
  );

  const handleEdit = (fornecedor: FornecedorSubcontratadoRow) => {
    setEditingFornecedor(fornecedor);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingFornecedor(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (fornecedor: FornecedorSubcontratadoRow) => {
    try {
      const result = await checkDelete({ id: fornecedor.id });
      const count = Number(result?.[0]?.auditorias_count || 0);

      if (count > 0) {
        await toggleStatus({
          id: fornecedor.id,
          status: 'inativo',
        });

        toast({
          description: 'Esse fornecedor possui auditorias vinculadas e foi inativado em vez de excluído.',
        });
        refresh();
        return;
      }

      await deleteFornecedor({ id: fornecedor.id });
      toast({ description: 'Fornecedor subcontratado excluído com sucesso.' });
      refresh();
    } catch {
      toast({
        description: 'Não foi possível excluir o fornecedor subcontratado.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async (fornecedor: FornecedorSubcontratadoRow) => {
    try {
      await toggleStatus({
        id: fornecedor.id,
        status: fornecedor.status === 'ativo' ? 'inativo' : 'ativo',
      });
      toast({
        description:
          fornecedor.status === 'ativo'
            ? 'Fornecedor subcontratado inativado com sucesso.'
            : 'Fornecedor subcontratado reativado com sucesso.',
      });
      refresh();
    } catch {
      toast({
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Auditoria > Fornecedores Subcontratados"
        description="Base de fornecedores e subcontratados utilizada nas linhas auditadas das obras."
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate} className={listingPrimaryButtonClassName}>
                <Plus className="mr-2 h-4 w-4" />
                Novo fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{editingFornecedor ? 'Editar fornecedor subcontratado' : 'Cadastrar fornecedor subcontratado'}</DialogTitle>
              </DialogHeader>
              <FornecedorSubcontratadoForm
                fornecedor={editingFornecedor || undefined}
                onCancel={() => setIsDialogOpen(false)}
                onSuccess={() => {
                  setIsDialogOpen(false);
                  refresh();
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className={`${listingFilterFieldClassName} pl-10`}
                placeholder="Nome, fantasia ou CPF/CNPJ/EIN"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'ativo' | 'inativo') => setStatusFilter(value)}>
              <SelectTrigger className={listingFilterFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className={listingSecondaryButtonClassName}
              onClick={() => {
                setSearchInput('');
                setStatusFilter('all');
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </ListingFilterCard>

      <ListingTableCard>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando fornecedores subcontratados...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-600">Erro ao carregar fornecedores subcontratados.</div>
          ) : sortedFornecedores.length === 0 ? (
            <ListingEmptyState
              icon={Plus}
              title="Nenhum fornecedor subcontratado encontrado"
              description="Cadastre o primeiro fornecedor subcontratado para utilizá-lo nas auditorias."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>Nome / Razão Social</TableHead>
                    <TableHead className={listingTableHeadClassName}>CPF/CNPJ/EIN</TableHead>
                    <TableHead className={listingTableHeadClassName}>Contato</TableHead>
                    <TableHead className={listingTableHeadClassName}>Status</TableHead>
                    <TableHead className={listingTableHeadClassName}>Auditorias</TableHead>
                    <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={listingTableCellClassName}>
                        <div>
                          <p className="font-medium text-slate-900">{fornecedor.nome_razao_social}</p>
                          <p className="text-xs text-slate-500">{fornecedor.nome_fantasia || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{fornecedor.cpf_cnpj}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <div>
                          <p className="font-medium text-slate-800">{fornecedor.contato_responsavel || '-'}</p>
                          <p className="text-xs text-slate-500">{fornecedor.telefone || fornecedor.email || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <FinanceStatusBadge label={fornecedor.status === 'ativo' ? 'Ativo' : 'Inativo'} tone={fornecedor.status === 'ativo' ? 'success' : 'neutral'} />
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{fornecedor.auditorias_vinculadas}</TableCell>
                      <TableCell className={`${listingTableCellClassName} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(fornecedor)} tone="brand" />
                          <FinanceActionButton
                            icon={ToggleLeft}
                            title={fornecedor.status === 'ativo' ? 'Inativar' : 'Ativar'}
                            onClick={() => handleToggleStatus(fornecedor)}
                            tone="warning"
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-rose-200 p-0 text-rose-600 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir fornecedor subcontratado?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se houver auditorias vinculadas, o registro será apenas inativado para preservar o histórico.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(fornecedor)}>Confirmar</AlertDialogAction>
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
  );
}
