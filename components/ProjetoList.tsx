'use client';

import { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Image, Pencil, Trash2, Eye } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import loadProjetosAction from '@/actions/loadProjetos';
import deleteProjetoAction from '@/actions/deleteProjeto';
import checkProjetoRestrictiveRelationshipsAction from '@/actions/checkProjetoRestrictiveRelationships';
import { ProjetoForm } from './ProjetoForm';
import { ProjetoFileViewer } from './ProjetoFileViewer';
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

interface Projeto {
  id: number;
  name: string;
  address?: string;
  city?: string;
  construction_sqft?: number;
  land_sqft?: number;
  predicted_sale_value?: number;
  status?: string;
  photo_urls?: string[];
  document_urls?: string[];
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
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerData, setFileViewerData] = useState<{
    files: string[];
    title: string;
    type: 'photos' | 'documents';
  }>({ files: [], title: '', type: 'photos' });

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
      // Check if project has restrictive relationships that prevent deletion
      const relationships = await checkProjetoRestrictiveRelationships({ projetoId });
      const rel = relationships[0];
      
      if (!rel) {
        toast({
          title: 'Erro',
          description: 'Projeto não encontrado.',
          variant: 'destructive',
        });
        return;
      }

      // Relacionamentos que IMPEDEM a exclusão (críticos financeiros)
      const hasRestrictiveRelationships = 
        rel.contas_receber_projetos_diretas > 0 || 
        rel.contas_pagar_projetos_diretas > 0 || 
        rel.contas_pagar_via_orcamento > 0 ||
        rel.contas_receber_via_aporte > 0;

      if (hasRestrictiveRelationships) {
        const restrictions = [];
        if (rel.contas_receber_projetos_diretas > 0) {
          restrictions.push(`${rel.contas_receber_projetos_diretas} conta(s) a receber vinculada(s) diretamente`);
        }
        if (rel.contas_pagar_projetos_diretas > 0) {
          restrictions.push(`${rel.contas_pagar_projetos_diretas} conta(s) a pagar vinculada(s) diretamente`);
        }
        if (rel.contas_pagar_via_orcamento > 0) {
          restrictions.push(`${rel.contas_pagar_via_orcamento} conta(s) a pagar vinculada(s) ao orçamento`);
        }
        if (rel.contas_receber_via_aporte > 0) {
          restrictions.push(`${rel.contas_receber_via_aporte} conta(s) a receber vinculada(s) ao aporte`);
        }

        toast({
          title: 'Exclusão não permitida',
          description: `Este projeto não pode ser excluído porque possui: ${restrictions.join(', ')}. Remova essas movimentações financeiras primeiro.`,
          variant: 'destructive',
        });
        return;
      }

      // Relacionamentos que podem ser removidos automaticamente
      const hasRemovableRelationships = 
        rel.orcamentos > 0 ||
        rel.projeto_members > 0 ||
        rel.previsao_aportes > 0;

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
        toast({
          title: 'Sucesso',
          description: 'Projeto excluído com sucesso!',
        });
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

  const handleViewFiles = (projetoId: number, projetoName: string, type: 'photos' | 'documents') => {
    // For now, we'll redirect to the project edit form where files can be managed
    // In a future update, we could create a dedicated file viewer that loads files from the database
    handleEdit(projetos.find((p: Projeto) => p.id === projetoId)!);
  };

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

        <ListingTableCard>
          <CardContent className="p-0">
            {projetos.length === 0 ? (
              <ListingEmptyState
                icon={Plus}
                title="Nenhum projeto encontrado"
                description='Clique em "Novo Projeto" para começar.'
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className={listingTableHeadClassName}>Nome</TableHead>
                      <TableHead className={listingTableHeadClassName}>Status</TableHead>
                      <TableHead className={listingTableHeadClassName}>Cidade</TableHead>
                      <TableHead className={listingTableHeadClassName}>Membros</TableHead>
                      <TableHead className={listingTableHeadClassName}>Valor Previsto</TableHead>
                      <TableHead className={listingTableHeadClassName}>Orçamentos</TableHead>
                      <TableHead className={listingTableHeadClassName}>Fotos</TableHead>
                      <TableHead className={listingTableHeadClassName}>Documentos</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projetos.map((projeto: Projeto) => {
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
                            {projeto.predicted_sale_value ? (
                              `$ ${projeto.predicted_sale_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            ) : '-'}
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
                          <TableCell className={listingTableCellClassName}>
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                              onClick={() => handleViewFiles(projeto.id, projeto.name, 'photos')}
                            >
                              <Image className="h-4 w-4 text-sky-600" />
                              Ver fotos
                            </button>
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                              onClick={() => handleViewFiles(projeto.id, projeto.name, 'documents')}
                            >
                              <FileText className="h-4 w-4 text-emerald-600" />
                              Ver docs
                            </button>
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
            )}
          </CardContent>
        </ListingTableCard>
      </div>

      <ProjetoFileViewer
        files={fileViewerData.files}
        title={fileViewerData.title}
        type={fileViewerData.type}
        isOpen={fileViewerOpen}
        onClose={() => setFileViewerOpen(false)}
      />
    </>
  );
}
