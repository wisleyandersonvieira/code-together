'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Edit, 
  Trash2, 
  Plus,
  Calculator,
  TrendingUp,
  TrendingDown,
  Banknote,
  Share,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { GrupoContabilForm } from './GrupoContabilForm';
import { useToast } from '@/hooks/use-toast';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import deleteGrupoContabilAction from '@/actions/deleteGrupoContabil';

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

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'Receita':
        return <TrendingUp className="h-4 w-4" />;
      case 'Despesa':
        return <TrendingDown className="h-4 w-4" />;
      case 'Investimento':
        return <Banknote className="h-4 w-4" />;
      case 'Distribuição':
        return <Share className="h-4 w-4" />;
      default:
        return <Calculator className="h-4 w-4" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'Receita':
        return 'bg-green-100 text-green-800';
      case 'Despesa':
        return 'bg-red-100 text-red-800';
      case 'Investimento':
        return 'bg-blue-100 text-blue-800';
      case 'Distribuição':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Grupos Contábeis</h2>
          <p className="text-muted-foreground">
            Gerencie os grupos contábeis por tipo
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('descricao')}
                >
                  <div className="flex items-center">
                    Descrição
                    {getSortIcon('descricao')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('tipo')}
                >
                  <div className="flex items-center">
                    Tipo
                    {getSortIcon('tipo')}
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGrupos.map((grupo: any) => (
                <TableRow key={grupo.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {grupo.descricao}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTipoColor(grupo.tipo)}>
                      {getTipoIcon(grupo.tipo)}
                      <span className="ml-1">{grupo.tipo}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(grupo)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(grupo.id, grupo.descricao)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedGrupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhum grupo cadastrado</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece criando seu primeiro grupo contábil.
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeiro grupo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
