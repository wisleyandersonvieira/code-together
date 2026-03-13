'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KanbanCard } from '@/components/KanbanCard';
import { Trash2, Edit2, Check, X } from 'lucide-react';
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
}

interface KanbanColumnData {
  id: number;
  name: string;
  position: number;
  color: string;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [updateColumn] = useMutateAction(updateKanbanColumnAction);

  const { isOver, setNodeRef } = useDroppable({
    id: `column-${column.id}`,
  });

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da coluna não pode estar vazio.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateColumn({
        id: column.id,
        name: editName.trim(),
      });

      setIsEditing(false);
      onUpdateColumn();

      toast({
        title: 'Sucesso',
        description: 'Nome da coluna atualizado com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar nome da coluna.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditName(column.name);
    setIsEditing(false);
  };

  return (
    <div className="flex-shrink-0 w-80">
      <Card className={`h-full group ${isOver ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2 flex-1">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: column.color }}
              />
              {isEditing ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveEdit}
                    className="h-7 w-7 p-0"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="flex-1">{column.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                    title="Editar nome da coluna"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{projetos.length}</Badge>
              {projetos.length === 0 && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteColumn(column.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  title="Excluir coluna"
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
    </div>
  );
}
