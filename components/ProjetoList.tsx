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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Lista de Projetos</CardTitle>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-7xl max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => {
                // Prevent dialog from closing when clicking download links or other file actions
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
        </CardHeader>
        <CardContent>
          {projetos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum projeto encontrado. Clique em "Novo Projeto" para começar.
            </div>
          ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Valor Previsto</TableHead>
                  <TableHead>Orçamentos</TableHead>
                  <TableHead>Fotos</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetos.map((projeto: Projeto) => {
                  const totalOrcamento = projeto.orcamentos.reduce((sum, orc) => sum + orc.value, 0);
                  const totalPercentage = projeto.members.reduce((sum, m) => sum + m.percentage, 0);
                  
                  return (
                    <TableRow key={projeto.id}>
                      <TableCell className="font-medium">{projeto.name}</TableCell>
                      <TableCell>
                        <Badge variant={projeto.status === 'Concluído' ? 'default' : 'secondary'}>
                          {projeto.status || 'Em andamento'}
                        </Badge>
                      </TableCell>
                      <TableCell>{projeto.city || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {projeto.members.map((member, idx) => (
                            <div key={idx} className="text-sm">
                              {member.cliente_name || member.empresa_name || member.grupo_name}
                              <span className="text-muted-foreground ml-2">
                                ({member.cliente_name ? 'Cliente' : member.empresa_name ? 'Empresa' : 'Grupo'} - {member.percentage}%)
                              </span>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground">
                            Total: {totalPercentage.toFixed(2)}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {projeto.predicted_sale_value ? (
                          `$ ${projeto.predicted_sale_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">
                            {projeto.orcamentos.length} itens
                          </Badge>
                          {totalOrcamento > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Total: $ {totalOrcamento.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          onClick={() => handleViewFiles(projeto.id, projeto.name, 'photos')}
                        >
                          <Image className="h-4 w-4 text-blue-600" />
                          <span className="text-xs text-muted-foreground">Ver fotos</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          onClick={() => handleViewFiles(projeto.id, projeto.name, 'documents')}
                        >
                          <FileText className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-muted-foreground">Ver docs</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleView(projeto)}
                            title="Visualizar Projeto"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEdit(projeto)}
                            title="Editar Projeto"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDelete(projeto.id, projeto.name)}
                            disabled={isDeleting}
                            title="Excluir Projeto"
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
        </CardContent>
      </Card>

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
