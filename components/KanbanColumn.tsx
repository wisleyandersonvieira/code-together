'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KanbanCard } from '@/components/KanbanCard';
import { ColunaKanbanDialog, type ValoresColuna } from '@/components/ColunaKanbanDialog';
import { iconeDaColuna } from '@/lib/kanbanIcons';
import { Trash2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import updateKanbanColumnAction from '@/actions/updateKanbanColumn';

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

interface KanbanColumnProps {
  column: KanbanColumnData;
  projetos: Projeto[];
  onProjetoClick: (projeto: Projeto) => void;
  onDeleteColumn: (columnId: number) => void;
  onUpdateColumn: () => void;
}

export function KanbanColumn({ column, projetos, onProjetoClick, onDeleteColumn, onUpdateColumn }: KanbanColumnProps) {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [updateColumn] = useMutateAction(updateKanbanColumnAction);
  const Icone = iconeDaColuna(column.icon);

  const { isOver, setNodeRef } = useDroppable({
    id: `column-${column.id}`,
  });

  const salvarColuna = async (valores: ValoresColuna) => {
    try {
      await updateColumn({ id: column.id, ...valores });
      setEditando(false);
      onUpdateColumn();
      toast({ title: 'Sucesso', description: 'Coluna atualizada com sucesso.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar a coluna.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex-shrink-0 w-80">
      <Card className={`h-full group ${isOver ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${column.color}1F` }}
              >
                <Icone className="h-4 w-4" style={{ color: column.color }} />
              </span>
              <span className="truncate">{column.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditando(true)}
                className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                title="Editar coluna"
                aria-label={`Editar a coluna ${column.name}`}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Badge variant="secondary">{projetos.length}</Badge>
              {projetos.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteColumn(column.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  title="Excluir coluna"
                  aria-label={`Excluir a coluna ${column.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div
            ref={setNodeRef}
            className="space-y-3 min-h-[200px]"
          >
            {projetos.map((projeto) => (
              <KanbanCard
                key={projeto.id}
                projeto={projeto}
                onClick={() => onProjetoClick(projeto)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <ColunaKanbanDialog
        open={editando}
        onOpenChange={setEditando}
        modo="editar"
        valorInicial={{ name: column.name, color: column.color, icon: column.icon }}
        onSalvar={salvarColuna}
      />
    </div>
  );
}
