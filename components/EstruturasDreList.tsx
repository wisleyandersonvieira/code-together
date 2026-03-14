'use client';

import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateForDisplay } from '@/utils/timezone';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import deleteEstruturaDreAction from '@/actions/deleteEstruturaDre';
import {
  FinanceActionButton,
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';

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
      <ListingPageHeader
        title="Estrutura DRE"
        description="Gerencie estruturas do demonstrativo com o mesmo padrão visual das demais áreas do sistema."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Estrutura
          </Button>
        }
      />

      <ListingTableCard>
        <CardHeader className="border-b border-slate-200/80 bg-slate-50/70">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <FileText className="h-5 w-5 text-slate-500" />
            Estruturas Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {estruturasLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">Carregando estruturas...</div>
          ) : estruturasError ? (
            <div className="py-10 text-center text-sm text-rose-600">Erro ao carregar estruturas</div>
          ) : !estruturas || estruturas.length === 0 ? (
            <ListingEmptyState
              icon={FileText}
              title="Nenhuma estrutura DRE cadastrada"
              description="Crie a primeira estrutura para começar."
              action={
                <Button className={listingPrimaryButtonClassName} onClick={onCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeira estrutura
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>Nome da Estrutura</TableHead>
                    <TableHead className={listingTableHeadClassName}>Data de Criação</TableHead>
                    <TableHead className={listingTableHeadClassName}>Última Atualização</TableHead>
                    <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estruturas.map((estrutura: EstruturaDre) => (
                    <TableRow key={estrutura.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{estrutura.nome}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatDateForDisplay(estrutura.created_at)}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatDateForDisplay(estrutura.updated_at)}</TableCell>
                      <TableCell className={`${listingTableCellClassName} text-right`}>
                        <div className="flex justify-end gap-2">
                          <FinanceActionButton icon={Edit} title="Editar" onClick={() => onEdit(estrutura)} tone="brand" />
                          <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(estrutura.id, estrutura.nome)} tone="danger" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </ListingTableCard>
    </div>
  );
}
