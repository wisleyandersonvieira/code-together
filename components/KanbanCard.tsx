'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { CheckCircle, MessageCircle, User, DollarSign } from 'lucide-react';
import loadProjetoOrcamentoPercentualAction from '@/actions/loadProjetoOrcamentoPercentual';

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

interface KanbanCardProps {
  projeto: Projeto;
  onClick: () => void;
  isDragging?: boolean;
}

export function KanbanCard({ projeto, onClick, isDragging = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: dndIsDragging,
  } = useDraggable({
    id: projeto.id.toString(),
  });

  const [orcamentoData] = useLoadAction(
    loadProjetoOrcamentoPercentualAction,
    [],
    { projetoId: projeto.id }
  );

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const taskProgress = projeto.total_tasks > 0 
    ? Math.round((projeto.completed_tasks / projeto.total_tasks) * 100)
    : 0;

  const orcamentoPercentual = orcamentoData && orcamentoData.length > 0 
    ? orcamentoData[0].percentual_realizado || 0
    : 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        dndIsDragging || isDragging ? 'opacity-50' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-sm leading-tight">{projeto.name}</h4>
            <Badge 
              variant={projeto.status === 'Concluído' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {projeto.status}
            </Badge>
          </div>

          {projeto.client_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {projeto.client_name}
            </div>
          )}

          {projeto.total_tasks > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle className="h-3 w-3" />
                <span>{projeto.completed_tasks}/{projeto.total_tasks} tarefas</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-green-600 h-1.5 rounded-full transition-all" 
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
            </div>
          )}

          {orcamentoPercentual > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>Orçamento</span>
              </div>
              <span className="font-medium">{orcamentoPercentual}%</span>
            </div>
          )}

          {projeto.comment_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              {projeto.comment_count}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
