'use client';

import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Eye, ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import loadProjetosAction from '@/actions/loadProjetos';
import deleteProjetoAction from '@/actions/deleteProjeto';
import checkProjetoRestrictiveRelationshipsAction from '@/actions/checkProjetoRestrictiveRelationships';
import { ProjetoForm } from './ProjetoForm';
import { useToast } from '@/hooks/use-toast';
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

const PAGE_SIZE = 10;

interface Projeto {
  id: number;
  name: string;
  address?: string;
  city?: string;
  construction_sqft?: number;
  land_sqft?: number;
  predicted_sale_value?: number;
  status?: string;
  created_at: string;
  orcamentos: Array<{
    id: number;
    description: string;
    fornecedor_name?: string;
    value: number;
  }>;
  members: Array<{
    cliente_id?: number;
    empresa_id?: number;
    grupo_id?: number;
    cliente_name?: string;
    empresa_name?: string;
    grupo_name?: string;
    percentage: number;
  }>;
}

interface ProjetoListProps {
  onCreateNew?: () => void;
}

export function ProjetoList({ onCreateNew }: ProjetoListProps) {
  const { toast } = useToast();
  const [projetos, loading, error, refresh] = useLoadAction(loadProjetosAction, []);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [deleteProjeto, isDeleting] = useMutateAction(deleteProjetoAction);
  const [checkProjetoRestrictiveRelationships] = useMutateAction(checkProjetoRestrictiveRelationshipsAction);

  const [filterName, setFilterName] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleEdit = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsFormOpen(true);
  };

  const handleView = (projeto: Projeto) => {
    setSelectedProjeto(projeto);
    setIsEditMode(false);
    setIsViewMode(true);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedProjeto(null);
    setIsEditMode(false);
    setIsViewMode(false);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedProjeto(null);
    setIsViewMode(false);
    refresh();
  };

  const handleDelete = async (projetoId: number, projetoName: string) => {
    try {
      const relationships = await checkProjetoRestrictiveRelationships({ projetoId });
      const rel = relationships[0];

      if (!rel) {
        toast({ title: 'Erro', description: 'Projeto não encontrado.', variant: 'destructive' });
        return;
      }

      const hasRestrictiveRelationships =
        rel.contas_receber_projetos_diretas > 0 ||
        rel.contas_pagar_projetos_diretas > 0 ||
        rel.contas_pagar_via_orcamento > 0 ||
        rel.contas_receber_via_aporte > 0;

      if (hasRestrictiveRelationships) {
        const restrictions = [];
        if (rel.contas_receber_projetos_diretas > 0) restrictions.push(`${rel.contas_receber_projetos_diretas} conta(s) a receber vinculada(s) diretamente`);
        if (rel.contas_pagar_projetos_diretas > 0) restrictions.push(`${rel.contas_pagar_projetos_diretas} conta(s) a pagar vinculada(s) diretamente`);
        if (rel.contas_pagar_via_orcamento > 0) restrictions.push(`${rel.contas_pagar_via_orcamento} conta(s) a pagar vinculada(s) ao orçamento`);
        if (rel.contas_receber_via_aporte > 0) restrictions.push(`${rel.contas_receber_via_aporte} conta(s) a receber vinculada(s) ao aporte`);
        toast({
          title: 'Exclusão não permitida',
          description: `Este projeto não pode ser excluído porque possui: ${restrictions.join(', ')}. Remova essas movimentações financeiras primeiro.`,
          variant: 'destructive',
        });
        return;
      }

      const hasRemovableRelationships = rel.orcamentos > 0 || rel.projeto_members > 0 || rel.previsao_aportes > 0;
      let warningMessage = '';
      if (hasRemovableRelationships) {
        const relations = [];
        if (rel.orcamentos > 0) relations.push(`${rel.orcamentos} orçamento(s)`);
        if (rel.projeto_members > 0) relations.push(`${rel.projeto_members} membro(s)`);
        if (rel.previsao_aportes > 0) relations.push(`${rel.previsao_aportes} previsão(ões) de aporte`);
        warningMessage = `Este projeto possui: ${relations.join(', ')}. Esses dados serão removidos automaticamente.`;
      }

      const confirmMessage = hasRemovableRelationships
        ? `ATENÇÃO: ${warningMessage}\n\nTem certeza que deseja excluir o projeto "${projetoName}"?`
        : `Tem certeza que deseja excluir o projeto "${projetoName}"?`;

      if (window.confirm(confirmMessage)) {
        await deleteProjeto({ id: projetoId });
        toast({ title: 'Sucesso', description: 'Projeto excluído com sucesso!' });
        refresh();
      }
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir projeto. Verifique se não há movimentações financeiras vinculadas e tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSort = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const processedProjetos = useMemo(() => {
    const nameFilter = filterName.toLowerCase();
    const memberFilter = filterMember.toLowerCase();
    return (projetos as Projeto[])
      .filter(p => {
        const matchName = !nameFilter || p.name.toLowerCase().includes(nameFilter);
        const matchMember =
          !memberFilter ||
          p.members.some(m =>
            (m.cliente_name || '').toLowerCase().includes(memberFilter) ||
            (m.empresa_name || '').toLowerCase().includes(memberFilter) ||
            (m.grupo_name || '').toLowerCase().includes(memberFilter),
          );
        return matchName && matchMember;
      })
      .sort((a, b) =>
        sortOrder === 'asc'
          ? a.name.localeCompare(b.name, 'pt-BR')
          : b.name.localeCompare(a.name, 'pt-BR'),
      );
  }, [projetos, filterName, filterMember, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedProjetos.length / PAGE_SIZE));
  const paginatedProjetos = processedProjetos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando projetos...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar projetos</div>
        </CardContent>
      </Card>
    );
  }

  const SortIcon = sortOrder === 'asc' ? ChevronUp : ChevronDown;

  return (
    <>
      <div className="space-y-6">
        <ListingPageHeader
          title="Projetos"
          description="Acompanhe portfólio, membros e documentação em uma listagem padronizada com o módulo financeiro."
          action={
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className={listingPrimaryButtonClassName} onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent
                className="max-w-7xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => {
                  const target = e.target as Element;
                  if (target.closest('.file-manager-content') || target.tagName === 'A') {
                    e.preventDefault();
                  }
                }}
              >
                <DialogHeader>
                  <DialogTitle>
                    {isViewMode ? 'Visualizar Projeto' : isEditMode ? 'Editar Projeto' : 'Criar Novo Projeto'}
                  </DialogTitle>
                </DialogHeader>
                <ProjetoForm
                  projeto={selectedProjeto || undefined}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setIsFormOpen(false)}
                  readOnly={isViewMode}
                />
              </DialogContent>
            </Dialog>
          }
        />

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filtrar por nome do projeto..."
              value={filterName}
              onChange={handleFilterChange(setFilterName)}
              className="pl-9"
            />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filtrar por nome do membro..."
              value={filterMember}
              onChange={handleFilterChange(setFilterMember)}
              className="pl-9"
            />
          </div>
        </div>

        <ListingTableCard>
          <CardContent className="p-0">
            {processedProjetos.length === 0 ? (
              <ListingEmptyState
                icon={Plus}
                title="Nenhum projeto encontrado"
                description={
                  filterName || filterMember
                    ? 'Nenhum projeto corresponde aos filtros aplicados.'
                    : 'Clique em "Novo Projeto" para começar.'
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                        <TableHead className={listingTableHeadClassName}>
                          <button
                            type="button"
                            onClick={handleToggleSort}
                            className="flex items-center gap-1 font-semibold hover:text-slate-900 transition-colors"
                          >
                            Nome
                            <SortIcon className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead className={listingTableHeadClassName}>Status</TableHead>
                        <TableHead className={listingTableHeadClassName}>Cidade</TableHead>
                        <TableHead className={listingTableHeadClassName}>Membros</TableHead>
                        <TableHead className={listingTableHeadClassName}>Valor Previsto</TableHead>
                        <TableHead className={listingTableHeadClassName}>Orçamentos</TableHead>
                        <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjetos.map((projeto: Projeto) => {
                        const totalOrcamento = projeto.orcamentos.reduce((sum, orc) => sum + orc.value, 0);
                        const totalPercentage = projeto.members.reduce((sum, m) => sum + m.percentage, 0);

                        return (
                          <TableRow key={projeto.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{projeto.name}</TableCell>
                            <TableCell className={listingTableCellClassName}>
                              <FinanceStatusBadge
                                label={projeto.status || 'Em andamento'}
                                tone={projeto.status === 'Concluído' ? 'success' : 'warning'}
                              />
                            </TableCell>
                            <TableCell className={listingTableCellClassName}>{projeto.city || '-'}</TableCell>
                            <TableCell className={listingTableCellClassName}>
                              <div className="space-y-1">
                                {projeto.members.map((member, idx) => (
                                  <div key={idx} className="text-sm text-slate-700">
                                    {member.cliente_name || member.empresa_name || member.grupo_name}
                                    <span className="ml-2 text-xs text-slate-500">
                                      ({member.cliente_name ? 'Cliente' : member.empresa_name ? 'Empresa' : 'Grupo'} - {member.percentage}%)
                                    </span>
                                  </div>
                                ))}
                                <div className="text-xs font-medium text-slate-500">
                                  Total: {totalPercentage.toFixed(2)}%
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={`${listingTableCellClassName} font-medium text-slate-800`}>
                              {projeto.predicted_sale_value
                                ? `$ ${projeto.predicted_sale_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                : '-'}
                            </TableCell>
                            <TableCell className={listingTableCellClassName}>
                              <div className="space-y-1">
                                <FinanceStatusBadge label={`${projeto.orcamentos.length} itens`} tone="neutral" />
                                {totalOrcamento > 0 && (
                                  <div className="text-xs text-slate-500">
                                    Total: $ {totalOrcamento.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={`${listingTableCellClassName} text-right`}>
                              <div className="flex justify-end gap-2">
                                <FinanceActionButton icon={Eye} title="Visualizar Projeto" onClick={() => handleView(projeto)} />
                                <FinanceActionButton icon={Pencil} title="Editar Projeto" onClick={() => handleEdit(projeto)} tone="brand" />
                                <FinanceActionButton
                                  icon={Trash2}
                                  title="Excluir Projeto"
                                  onClick={() => handleDelete(projeto.id, projeto.name)}
                                  tone="danger"
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    {processedProjetos.length} projeto(s) · Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </ListingTableCard>
      </div>
    </>
  );
}
