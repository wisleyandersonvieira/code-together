'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Edit, 
  Trash2, 
  Plus,
  Calculator,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { GrupoContabilForm } from './GrupoContabilForm';
import { useToast } from '@/hooks/use-toast';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import deleteGrupoContabilAction from '@/actions/deleteGrupoContabil';
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

type SortColumn = 'descricao' | 'tipo';
type SortDirection = 'asc' | 'desc';

export function GrupoContabilList() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('descricao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [grupos, loading, error, refreshGrupos] = useLoadAction(loadGruposContabeisAction, []);
  const [deleteGrupo] = useMutateAction(deleteGrupoContabilAction);

  const handleEdit = (grupo: any) => {
    setEditingGrupo(grupo);
    setShowForm(true);
  };

  const handleDelete = async (id: number, descricao: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o grupo "${descricao}"?`)) {
      return;
    }

    try {
      await deleteGrupo({ id });
      toast({
        title: "Grupo excluído",
        description: "O grupo contábil foi excluído com sucesso.",
      });
      refreshGrupos();
    } catch (error) {
      console.error('Error deleting grupo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o grupo contábil.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingGrupo(null);
    refreshGrupos();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingGrupo(null);
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedGrupos = useMemo(() => {
    if (!grupos || grupos.length === 0) return [];
    
    const sorted = [...grupos].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'descricao':
          valueA = a.descricao?.toLowerCase() || '';
          valueB = b.descricao?.toLowerCase() || '';
          break;
        case 'tipo':
          valueA = a.tipo?.toLowerCase() || '';
          valueB = b.tipo?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [grupos, sortColumn, sortDirection]);

  const getSortIcon = (column: SortColumn) => {
    if (column !== sortColumn) {
      return <ArrowUpDown className="h-4 w-4 ml-2 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-2" />
      : <ArrowDown className="h-4 w-4 ml-2" />;
  };

  if (showForm) {
    return (
      <GrupoContabilForm
        grupo={editingGrupo}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando grupos contábeis...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar grupos contábeis: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Grupos Contábeis"
        description="Gerencie grupos por tipo com o mesmo padrão premium das listagens financeiras."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Grupo
          </Button>
        }
      />

      <ListingTableCard>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead 
                  className={`${listingTableHeadClassName} cursor-pointer hover:bg-slate-100/70`}
                  onClick={() => handleSort('descricao')}
                >
                  <div className="flex items-center">
                    Descrição
                    {getSortIcon('descricao')}
                  </div>
                </TableHead>
                <TableHead 
                  className={`${listingTableHeadClassName} cursor-pointer hover:bg-slate-100/70`}
                  onClick={() => handleSort('tipo')}
                >
                  <div className="flex items-center">
                    Tipo
                    {getSortIcon('tipo')}
                  </div>
                </TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGrupos.map((grupo: any) => (
                <TableRow key={grupo.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                    {grupo.descricao}
                  </TableCell>
                  <TableCell className={listingTableCellClassName}>
                    <FinanceStatusBadge label={grupo.tipo} tone={grupo.tipo === 'Receita' ? 'success' : grupo.tipo === 'Despesa' ? 'danger' : 'neutral'} />
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-right`}>
                    <div className="flex justify-end gap-2">
                      <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(grupo)} tone="brand" />
                      <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(grupo.id, grupo.descricao)} tone="danger" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedGrupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="px-4">
                    <ListingEmptyState
                      icon={Calculator}
                      title="Nenhum grupo contábil cadastrado"
                      description="Comece criando seu primeiro grupo contábil."
                      action={
                        <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar primeiro grupo
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </ListingTableCard>
    </div>
  );
}
