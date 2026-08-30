'use client';

import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Kanban as KanbanIcon } from 'lucide-react';
import { KanbanColumn } from '@/components/KanbanColumn';
import { ColunaKanbanDialog, type ValoresColuna } from '@/components/ColunaKanbanDialog';
import { KanbanCard } from '@/components/KanbanCard';
import { ProjetoModal } from '@/components/ProjetoModal';
import loadKanbanColumnsAction from '@/actions/loadKanbanColumns';
import loadProjetosByColumnAction from '@/actions/loadProjetosByColumn';
import createKanbanColumnAction from '@/actions/createKanbanColumn';
import moveProjetoToColumnAction from '@/actions/moveProjetoToColumn';
import deleteKanbanColumnAction from '@/actions/deleteKanbanColumn';
import { useCurrentUser } from '@/lib/userContext';

interface Projeto {
  id: number;
  name: string;
  status: string;
  created_at: string;
  kanban_column_id: number;
  kanban_position: number;
  client_name?: string;
  total_tasks: number;
  completed_tasks: number;
  comment_count: number;
  percentual_realizado?: number;
}

interface KanbanColumnData {
  id: number;
  name: string;
  position: number;
  color: string;
  /** Nome lucide-react. NULL = ícone padrão. Ver lib/kanbanIcons.ts. */
  icon: string | null;
  projeto_count: number;
}

export function Kanban() {
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const userId = currentUser?.legacy_user_id ?? null;

  const [showNewColumnDialog, setShowNewColumnDialog] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [draggedItem, setDraggedItem] = useState<Projeto | null>(null);

  // Load kanban data
  const [columns, loadingColumns, , refreshColumns] = useLoadAction(loadKanbanColumnsAction, []);
  const [projetos, loadingProjetos, , refreshProjetos] = useLoadAction(
    loadProjetosByColumnAction,
    [],
    { columnId: 0 }
  );
  // Actions
  const [createColumn] = useMutateAction(createKanbanColumnAction);
  const [moveProjeto] = useMutateAction(moveProjetoToColumnAction);
  const [deleteColumn] = useMutateAction(deleteKanbanColumnAction);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleCreateColumn = async (valores: ValoresColuna) => {
    try {
      await createColumn(valores);
      setShowNewColumnDialog(false);
      refreshColumns();
      toast({ title: 'Sucesso', description: 'Nova coluna criada com sucesso.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar nova coluna.',
        variant: 'destructive',
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const projeto = projetos?.find(p => p.id.toString() === event.active.id);
    setDraggedItem(projeto || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over || active.id === over.id) return;

    const projetoId = parseInt(active.id.toString());
    const newColumnId = parseInt(over.id.toString().replace('column-', ''));
    
    const projeto = projetos?.find(p => p.id === projetoId);
    if (!projeto || projeto.kanban_column_id === newColumnId) return;

    // Optimistic update
    if (projetos) {
      const updatedProjetos = projetos.map(p => 
        p.id === projetoId 
          ? { ...p, kanban_column_id: newColumnId }
          : p
      );
      // Note: In a real implementation, you would update the local state here
    }

    try {
      // Move the project (já registra o histórico automaticamente)
      await moveProjeto({
        projetoId,
        columnId: newColumnId,
        position: 0,
        userId,
      });

      refreshProjetos();
      refreshColumns();

      toast({
        title: 'Sucesso',
        description: 'Projeto movido com sucesso.',
      });
    } catch (error) {
      refreshProjetos(); // Revert optimistic update
      toast({
        title: 'Erro',
        description: 'Erro ao mover projeto.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    const projetosInColumn = getProjetosByColumn(columnId);
    
    if (projetosInColumn.length > 0) {
      toast({
        title: 'Erro',
        description: 'Não é possível excluir uma coluna que contém projetos.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await deleteColumn({ columnId });
      refreshColumns();
      
      toast({
        title: 'Sucesso',
        description: 'Coluna excluída com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir coluna.',
        variant: 'destructive',
      });
    }
  };

  const getProjetosByColumn = (columnId: number) => {
    const filtered = projetos?.filter(p => p.kanban_column_id === columnId) || [];
    return filtered;
  };

  if (loadingColumns || loadingProjetos) {
    return <div className="text-center py-8">Carregando kanban...</div>;
  }

  // Um único formulário de coluna para os dois estados de layout abaixo — antes
  // eram dois blocos de JSX idênticos, que só divergiriam com o tempo.
  const botaoNovaColuna = (
    <Button onClick={() => setShowNewColumnDialog(true)}>
      <Plus className="mr-2 h-4 w-4" />
      Nova Coluna
    </Button>
  );
  const dialogNovaColuna = (
    <ColunaKanbanDialog
      open={showNewColumnDialog}
      onOpenChange={setShowNewColumnDialog}
      modo="criar"
      onSalvar={handleCreateColumn}
    />
  );

  if (!columns || columns.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Painel - Kanban dos Projetos</h2>
        <p>Nenhuma coluna encontrada. Crie uma coluna primeiro.</p>
        {botaoNovaColuna}
        {dialogNovaColuna}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <KanbanIcon className="mr-3 h-6 w-6" />
            Painel - Kanban dos Projetos
          </h2>
          <p className="text-muted-foreground">
            Gerencie seus projetos de forma visual
          </p>
        </div>
        
        {botaoNovaColuna}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns?.map((column: KanbanColumnData) => (
            <KanbanColumn
              key={column.id}
              column={column}
              projetos={getProjetosByColumn(column.id)}
              onProjetoClick={setSelectedProjeto}
              onDeleteColumn={handleDeleteColumn}
              onUpdateColumn={refreshColumns}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedItem && (
            <KanbanCard
              projeto={draggedItem}
              onClick={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {dialogNovaColuna}

      {selectedProjeto && (
        <ProjetoModal
          projeto={selectedProjeto}
          isOpen={!!selectedProjeto}
          onClose={() => setSelectedProjeto(null)}
          onUpdate={() => {
            refreshProjetos();
            setSelectedProjeto(null);
          }}
        />
      )}
    </div>
  );
}
