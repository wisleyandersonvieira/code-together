'use client';

import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateForDisplay } from '@/utils/timezone';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import deleteEstruturaDreAction from '@/actions/deleteEstruturaDre';

interface EstruturaDre {
  id: number;
  nome: string;
  created_at: string;
  updated_at: string;
}

interface EstruturasDreListProps {
  onCreateNew: () => void;
  onEdit: (estrutura: EstruturaDre) => void;
}

export function EstruturasDreList({ onCreateNew, onEdit }: EstruturasDreListProps) {
  const { toast } = useToast();
  const [estruturas, estruturasLoading, estruturasError, refreshEstruturas] = useLoadAction(
    loadEstruturasDreAction,
    []
  );
  const [deleteEstrutura, isDeletingEstrutura] = useMutateAction(deleteEstruturaDreAction);

  const handleDelete = async (id: number, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a estrutura "${nome}"?`)) {
      return;
    }

    try {
      await deleteEstrutura({ id });
      toast({
        title: 'Sucesso',
        description: 'Estrutura DRE excluída com sucesso.',
      });
      refreshEstruturas();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir estrutura DRE.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estruturas DRE</h2>
          <p className="text-muted-foreground">
            Gerencie as estruturas do Demonstrativo de Resultado do Exercício
          </p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Estrutura
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Estruturas Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estruturasLoading ? (
            <div className="text-center py-8">Carregando estruturas...</div>
          ) : estruturasError ? (
            <div className="text-center py-8 text-red-500">Erro ao carregar estruturas</div>
          ) : !estruturas || estruturas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma estrutura DRE cadastrada.
              <br />
              <Button variant="link" onClick={onCreateNew} className="mt-2">
                Criar primeira estrutura
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Estrutura</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estruturas.map((estrutura: EstruturaDre) => (
                    <TableRow key={estrutura.id}>
                      <TableCell className="font-medium">{estrutura.nome}</TableCell>
                      <TableCell>{formatDateForDisplay(estrutura.created_at)}</TableCell>
                      <TableCell>{formatDateForDisplay(estrutura.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(estrutura)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(estrutura.id, estrutura.nome)}
                            disabled={isDeletingEstrutura}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
