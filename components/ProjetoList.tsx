'use client';

import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Eye, ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight, Users, LayoutGrid, List } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import loadProjetosAction from '@/actions/loadProjetos';
import deleteProjetoAction from '@/actions/deleteProjeto';
import checkProjetoRestrictiveRelationshipsAction from '@/actions/checkProjetoRestrictiveRelationships';
import { ProjetoForm } from './ProjetoForm';
import { ProjetoCards } from './ProjetoCards';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
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
  onOpenAportesPorCliente?: () => void;
}

export function ProjetoList({ onCreateNew, onOpenAportesPorCliente }: ProjetoListProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [projetos, loading, error, refresh] = useLoadAction(loadProjetosAction, []);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [deleteProjeto, isDeleting] = useMutateAction(deleteProjetoAction);
  const [checkProjetoRestrictiveRelationships] = useMutateAction(checkProjetoRestrictiveRelationshipsAction);

  const [filterName, setFilterName] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [filterStatus, setFilterStatus] = useState('Em andamento');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  // Visualização: cards (padrão) ou lista. Mantido em memória durante a navegação.
  const [viewMode, setViewMode] = useState<'cards' | 'lista'>('cards');
  // Bumped after mutations to force the cards query (independent from the list query) to reload.
  const [cardsReloadToken, setCardsReloadToken] = useState(0);

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

  // Card actions receive only the id — resolve to the full projeto (with orçamentos,
  // members, etc.) from the list data so the form opens with complete information.
  const handleViewById = (id: number) => {
    const projeto = (projetos as Projeto[]).find((p) => p.id === id);
    if (projeto) handleView(projeto);
  };

  const handleEditById = (id: number) => {
    const projeto = (projetos as Projeto[]).find((p) => p.id === id);
    if (projeto) handleEdit(projeto);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedProjeto(null);
    setIsViewMode(false);
    refresh();
    setCardsReloadToken((t) => t + 1);
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
        setCardsReloadToken((t) => t + 1);
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
        const projectStatus = p.status || 'Em andamento';
        const matchStatus = filterStatus === 'Todos' || projectStatus === filterStatus;
        return matchName && matchMember && matchStatus;
      })
      .sort((a, b) =>
        sortOrder === 'asc'
          ? a.name.localeCompare(b.name, 'pt-BR')
          : b.name.localeCompare(a.name, 'pt-BR'),
      );
  }, [projetos, filterName, filterMember, filterStatus, sortOrder]);

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
          action={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5">
                <Button
                  type="button"
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  className="px-2.5"
                  onClick={() => setViewMode('cards')}
                  aria-label="Visualização em cards"
                  title="Visualização em cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'lista' ? 'default' : 'ghost'}
                  size="sm"
                  className="px-2.5"
                  onClick={() => setViewMode('lista')}
                  aria-label="Visualização em lista"
                  title="Visualização em lista"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              {onOpenAportesPorCliente ? (
                <Button variant="outline" onClick={onOpenAportesPorCliente}>
                  <Users className="mr-2 h-4 w-4" />
                  Aportes por Cliente
                </Button>
              ) : null}
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button className={listingPrimaryButtonClassName} onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Projeto
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="max-w-7xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden"
                  onInteractOutside={(e) => {
                    const target = e.target as Element;
                    if (target.closest('.file-manager-content') || target.tagName === 'A') {
                      e.preventDefault();
                    }
                  }}
                >
                  <DialogTitle className="sr-only">
                    {isViewMode ? 'Visualizar Projeto' : isEditMode ? 'Editar Projeto' : 'Criar Novo Projeto'}
                  </DialogTitle>
                  <ProjetoForm
                    projeto={selectedProjeto || undefined}
                    onSuccess={handleFormSuccess}
                    onCancel={() => setIsFormOpen(false)}
                    readOnly={isViewMode}
                  />
                </DialogContent>
              </Dialog>
            </div>
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
          <div className="sm:w-48">
            <Select
              value={filterStatus}
              onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Em andamento">Em andamento</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
                <SelectItem value="Todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <ProjetoCards
            status={filterStatus}
            filterName={filterName}
            filterMember={filterMember}
            reloadToken={cardsReloadToken}
            onView={handleViewById}
            onEdit={handleEditById}
            onDelete={handleDelete}
          />
        ) : (
        <ListingTableCard>
          <CardContent className="p-0">
            {processedProjetos.length === 0 ? (
              <ListingEmptyState
                icon={Plus}
                title="Nenhum projeto encontrado"
                description={
                  filterName || filterMember || filterStatus !== 'Todos'
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
                        <TableHead
                          className={`${listingTableHeadClassName} cursor-pointer select-none hover:text-slate-900`}
                          onClick={handleToggleSort}
                        >
                          <span className="flex items-center gap-1">
                            Nome
                            <SortIcon className="h-4 w-4" />
                          </span>
                        </TableHead>
                        <TableHead className={`${listingTableHeadClassName} hidden sm:table-cell`}>Status</TableHead>
                        <TableHead className={`${listingTableHeadClassName} hidden sm:table-cell`}>Cidade</TableHead>
                        <TableHead className={listingTableHeadClassName}>Membros</TableHead>
                        <TableHead className={`${listingTableHeadClassName} hidden sm:table-cell`}>Valor Previsto</TableHead>
                        <TableHead className={`${listingTableHeadClassName} hidden sm:table-cell`}>Orçamentos</TableHead>
                        <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjetos.map((projeto: Projeto) => {
                        const totalOrcamento = projeto.orcamentos.reduce((sum, orc) => sum + orc.value, 0);

                        return (
                          <TableRow key={projeto.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{projeto.name}</TableCell>
                            <TableCell className={`${listingTableCellClassName} hidden sm:table-cell`}>
                              <FinanceStatusBadge
                                label={projeto.status || 'Em andamento'}
                                tone={projeto.status === 'Concluído' ? 'success' : 'warning'}
                              />
                            </TableCell>
                            <TableCell className={`${listingTableCellClassName} hidden sm:table-cell`}>{projeto.city || '-'}</TableCell>
                            <TableCell className={listingTableCellClassName}>
                              <div className="space-y-1">
                                {projeto.members.map((member, idx) => (
                                  <div key={idx} className="text-sm text-slate-700">
                                    {member.cliente_name || member.empresa_name || member.grupo_name}
                                    <span className="ml-2 text-xs text-slate-500">({member.percentage}%)</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className={`${listingTableCellClassName} hidden sm:table-cell font-medium text-slate-800`}>
                              {projeto.predicted_sale_value ? formatCurrency(projeto.predicted_sale_value) : '-'}
                            </TableCell>
                            <TableCell className={`${listingTableCellClassName} hidden sm:table-cell font-medium text-slate-800`}>
                              {totalOrcamento > 0 ? formatCurrency(totalOrcamento) : '-'}
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
        )}
      </div>
    </>
  );
}
