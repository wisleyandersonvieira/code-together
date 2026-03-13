'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Edit, 
  Trash2, 
  Plus,
  Calculator,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X
} from 'lucide-react';
import { SubgrupoContabilForm } from './SubgrupoContabilForm';
import { useToast } from '@/hooks/use-toast';
import loadSubgruposContabeisAction from '@/actions/loadSubgruposContabeis';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import deleteSubgrupoContabilAction from '@/actions/deleteSubgrupoContabil';

type SortColumn = 'descricao' | 'grupo' | 'funcao';
type SortDirection = 'asc' | 'desc';

export function SubgrupoContabilList() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSubgrupo, setEditingSubgrupo] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('descricao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('all');
  const [subgrupos, loading, error, refreshSubgrupos] = useLoadAction(
    loadSubgruposContabeisAction, 
    [], 
    { 
      searchTerm: appliedSearch || null,
      grupoId: selectedGrupoId === 'all' ? null : selectedGrupoId
    }
  );
  const [grupos] = useLoadAction(loadGruposContabeisAction, []);
  const [deleteSubgrupo] = useMutateAction(deleteSubgrupoContabilAction);

  const handleEdit = (subgrupo: any) => {
    setEditingSubgrupo(subgrupo);
    setShowForm(true);
  };

  const handleDelete = async (id: number, descricao: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o subgrupo "${descricao}"?`)) {
      return;
    }

    try {
      await deleteSubgrupo({ id });
      toast({
        title: "Subgrupo excluído",
        description: "O subgrupo contábil foi excluído com sucesso.",
      });
      refreshSubgrupos();
    } catch (error) {
      console.error('Error deleting subgrupo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o subgrupo contábil.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSubgrupo(null);
    refreshSubgrupos();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSubgrupo(null);
  };

  const handleSearch = () => {
    setAppliedSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setSelectedGrupoId('all');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const hasActiveFilters = appliedSearch || (selectedGrupoId !== 'all');

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedSubgrupos = useMemo(() => {
    if (!subgrupos || subgrupos.length === 0) return [];
    
    const sorted = [...subgrupos].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'descricao':
          valueA = a.descricao?.toLowerCase() || '';
          valueB = b.descricao?.toLowerCase() || '';
          break;
        case 'grupo':
          valueA = `${a.grupo_tipo} - ${a.grupo_descricao}`.toLowerCase() || '';
          valueB = `${b.grupo_tipo} - ${b.grupo_descricao}`.toLowerCase() || '';
          break;
        case 'funcao':
          valueA = a.funcao?.toLowerCase() || '';
          valueB = b.funcao?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [subgrupos, sortColumn, sortDirection]);

  const getSortIcon = (column: SortColumn) => {
    if (column !== sortColumn) {
      return <ArrowUpDown className="h-4 w-4 ml-2 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-2" />
      : <ArrowDown className="h-4 w-4 ml-2" />;
  };

  const getFuncaoIcon = (funcao: string) => {
    return funcao === 'Crédito' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getFuncaoColor = (funcao: string) => {
    return funcao === 'Crédito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  if (showForm) {
    return (
      <SubgrupoContabilForm
        subgrupo={editingSubgrupo}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando subgrupos contábeis...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar subgrupos contábeis: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Subgrupos Contábeis</h2>
          <p className="text-muted-foreground">
            Gerencie os subgrupos contábeis vinculados aos grupos
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Subgrupo
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Buscar por Nome
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Digite parte do nome..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Filtrar por Grupo
              </label>
              <Select value={selectedGrupoId} onValueChange={setSelectedGrupoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {grupos.map((grupo: any) => (
                    <SelectItem key={grupo.id} value={grupo.id.toString()}>
                      {grupo.tipo} - {grupo.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Filtrar
              </Button>
              
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  onClick={handleClearFilters}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Indicadores de filtros ativos */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4">
              {appliedSearch && (
                <Badge variant="secondary">
                  Busca: "{appliedSearch}"
                </Badge>
              )}
              {selectedGrupoId !== 'all' && (
                <Badge variant="secondary">
                  Grupo: {grupos.find((g: any) => g.id.toString() === selectedGrupoId)?.tipo} - {grupos.find((g: any) => g.id.toString() === selectedGrupoId)?.descricao}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                  onClick={() => handleSort('grupo')}
                >
                  <div className="flex items-center">
                    Grupo
                    {getSortIcon('grupo')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('funcao')}
                >
                  <div className="flex items-center">
                    Função
                    {getSortIcon('funcao')}
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSubgrupos.map((subgrupo: any) => (
                <TableRow key={subgrupo.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {subgrupo.descricao}
                  </TableCell>
                  <TableCell>
                    {subgrupo.grupo_tipo} - {subgrupo.grupo_descricao}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getFuncaoColor(subgrupo.funcao)}>
                      {getFuncaoIcon(subgrupo.funcao)}
                      <span className="ml-1">{subgrupo.funcao}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(subgrupo)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(subgrupo.id, subgrupo.descricao)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedSubgrupos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        {hasActiveFilters ? 'Nenhum subgrupo encontrado' : 'Nenhum subgrupo cadastrado'}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {hasActiveFilters 
                          ? 'Nenhum subgrupo encontrado com os filtros aplicados.'
                          : 'Comece criando seu primeiro subgrupo contábil.'
                        }
                      </p>
                      {!hasActiveFilters && (
                        <Button onClick={() => setShowForm(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Criar primeiro subgrupo
                        </Button>
                      )}
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
