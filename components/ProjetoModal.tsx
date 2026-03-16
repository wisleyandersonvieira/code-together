'use client';

import React, { useState, useCallback } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, CheckSquare, History, Plus, User, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import loadProjetoCommentsAction from '@/actions/loadProjetoComments';
import createProjetoCommentAction from '@/actions/createProjetoComment';
import loadProjetoTasksAction from '@/actions/loadProjetoTasks';
import createProjetoTaskAction from '@/actions/createProjetoTask';
import toggleProjetoTaskAction from '@/actions/toggleProjetoTask';
import loadProjetoColumnHistoryAction from '@/actions/loadProjetoColumnHistory';
import { ProjetoEvolucao } from '@/components/ProjetoEvolucao';
import { useCurrentUser } from '@/lib/userContext';

interface Projeto {
  id: number;
  name: string;
  status: string;
  created_at: string;
  client_name?: string;
  total_tasks: number;
  completed_tasks: number;
  comment_count: number;
}

interface ProjetoModalProps {
  projeto: Projeto;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function ProjetoModal({ projeto, isOpen, onClose, onUpdate }: ProjetoModalProps) {
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const userId = currentUser?.id ?? null;

  const [newComment, setNewComment] = useState('');
  const [newTask, setNewTask] = useState('');

  // Track which tabs have been visited to avoid loading data before needed
  // History is pre-loaded immediately so it's ready when the user navigates to the tab
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['comments', 'history']));

  const handleTabChange = useCallback((tab: string) => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  // Load data only when the corresponding tab has been visited
  const projetoParams = { projetoId: projeto.id };

  const [comments, loadingComments, , refreshComments] = useLoadAction(
    loadProjetoCommentsAction,
    [],
    visitedTabs.has('comments') ? projetoParams : undefined,
  );

  const [tasks, loadingTasks, , refreshTasks] = useLoadAction(
    loadProjetoTasksAction,
    [],
    visitedTabs.has('tasks') ? projetoParams : undefined,
  );

  const [history, loadingHistory] = useLoadAction(
    loadProjetoColumnHistoryAction,
    [],
    visitedTabs.has('history') ? projetoParams : undefined,
  );

  // Actions
  const [createComment] = useMutateAction(createProjetoCommentAction);
  const [createTask] = useMutateAction(createProjetoTaskAction);
  const [toggleTask] = useMutateAction(toggleProjetoTaskAction);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !userId) return;

    try {
      await createComment({ projetoId: projeto.id, userId, comment: newComment });
      setNewComment('');
      refreshComments();
      toast({ title: 'Sucesso', description: 'Comentário adicionado com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao adicionar comentário.', variant: 'destructive' });
    }
  }, [newComment, userId, projeto.id, createComment, refreshComments, toast]);

  const handleAddTask = useCallback(async () => {
    if (!newTask.trim() || !userId) return;

    try {
      await createTask({ projetoId: projeto.id, userId, taskName: newTask });
      setNewTask('');
      refreshTasks();
      toast({ title: 'Sucesso', description: 'Tarefa adicionada com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao adicionar tarefa.', variant: 'destructive' });
    }
  }, [newTask, userId, projeto.id, createTask, refreshTasks, toast]);

  const handleToggleTask = useCallback(async (taskId: number, isCompleted: boolean) => {
    if (!userId) return;

    try {
      await toggleTask({ taskId, isCompleted, userId });
      refreshTasks();
      toast({
        title: 'Sucesso',
        description: `Tarefa ${isCompleted ? 'concluída' : 'reativada'} com sucesso.`,
      });
    } catch {
      toast({ title: 'Erro', description: 'Erro ao atualizar tarefa.', variant: 'destructive' });
    }
  }, [userId, toggleTask, refreshTasks, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 pr-8">
            <span>{projeto.name}</span>
            <Badge variant={projeto.status === 'Concluído' ? 'default' : 'secondary'}>
              {projeto.status}
            </Badge>
          </DialogTitle>
          {projeto.client_name && (
            <DialogDescription className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {projeto.client_name}
            </DialogDescription>
          )}
        </DialogHeader>

        <Tabs defaultValue="comments" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid h-auto w-full grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-slate-50/85 p-2 shadow-sm">
            <TabsTrigger value="comments" className="min-h-[42px] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              <MessageCircle className="h-4 w-4" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="tasks" className="min-h-[42px] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              <CheckSquare className="h-4 w-4" />
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="min-h-[42px] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="history" className="min-h-[42px] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Adicione um comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Comentário
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loadingComments ? (
                <div className="text-center py-4">Carregando comentários...</div>
              ) : comments && comments.length > 0 ? (
                comments.map((comment: any) => (
                  <div key={comment.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {comment.user_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{comment.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'dd MMM yyyy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm">{comment.comment}</p>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum comentário ainda
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Adicione uma nova tarefa..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <Button onClick={handleAddTask} disabled={!newTask.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loadingTasks ? (
                <div className="text-center py-4">Carregando tarefas...</div>
              ) : tasks && tasks.length > 0 ? (
                tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={(checked) => handleToggleTask(task.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <span className={`text-sm ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.task_name}
                      </span>
                      <div className="text-xs text-muted-foreground mt-1">
                        Criado por {task.created_by_name} em {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ptBR })}
                        {task.is_completed && task.completed_by_name && (
                          <span> • Concluído por {task.completed_by_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma tarefa ainda
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="evolucao" className="space-y-4 mt-4">
            <ProjetoEvolucao
              projetoId={projeto.id}
              projetoName={projeto.name}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loadingHistory ? (
                <div className="text-center py-4">Carregando histórico...</div>
              ) : history && history.length > 0 ? (
                history.map((move: any) => (
                  <div key={move.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{move.user_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(move.moved_at), 'dd MMM yyyy HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>Moveu de</span>
                      <Badge
                        style={{ backgroundColor: move.from_column_color }}
                        className="text-white text-xs"
                      >
                        {move.from_column_name}
                      </Badge>
                      <span>para</span>
                      <Badge
                        style={{ backgroundColor: move.to_column_color }}
                        className="text-white text-xs"
                      >
                        {move.to_column_name}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma movimentação registrada
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
