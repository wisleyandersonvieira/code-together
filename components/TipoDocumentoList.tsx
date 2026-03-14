'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Edit, 
  Trash2, 
  Plus,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X
} from 'lucide-react';
import { TipoDocumentoForm } from './TipoDocumentoForm';
import { useToast } from '@/hooks/use-toast';
import loadTiposDocumentoAction from '@/actions/loadTiposDocumento';
import deleteTipoDocumentoAction from '@/actions/deleteTipoDocumento';
import {
  FinanceActionButton,
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingFilterFieldClassName,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';

type SortColumn = 'codigo' | 'descricao' | 'mascara';
type SortDirection = 'asc' | 'desc';

export function TipoDocumentoList() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingTipoDocumento, setEditingTipoDocumento] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Filters
  const [searchDescricao, setSearchDescricao] = useState('');

  const [tiposDocumento, loading, error, refreshTiposDocumento] = useLoadAction(loadTiposDocumentoAction, [], {
    searchDescricao: searchDescricao || null,
  });
  const [deleteTipoDocumento] = useMutateAction(deleteTipoDocumentoAction);

  const handleEdit = (tipoDocumento: any) => {
    setEditingTipoDocumento(tipoDocumento);
    setShowForm(true);
  };

  const handleDelete = async (id: number, descricao: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o tipo de documento "${descricao}"?`)) {
      return;
    }

    try {
      await deleteTipoDocumento({ id });
      toast({
        title: "Tipo de documento excluído",
        description: "O tipo de documento foi excluído com sucesso.",
      });
      refreshTiposDocumento();
    } catch (error) {
      console.error('Error deleting tipo documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o tipo de documento.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingTipoDocumento(null);
    refreshTiposDocumento();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTipoDocumento(null);
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setSearchDescricao('');
  };

  const sortedTiposDocumento = useMemo(() => {
    if (!tiposDocumento || tiposDocumento.length === 0) return [];
    
    const sorted = [...tiposDocumento].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'codigo':
          valueA = a.codigo || '';
          valueB = b.codigo || '';
          break;
        case 'descricao':
          valueA = a.descricao?.toLowerCase() || '';
          valueB = b.descricao?.toLowerCase() || '';
          break;
        case 'mascara':
          valueA = a.mascara?.toLowerCase() || '';
          valueB = b.mascara?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [tiposDocumento, sortColumn, sortDirection]);

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
      <TipoDocumentoForm
        tipoDocumento={editingTipoDocumento}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando tipos de documento...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar tipos de documento: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Tipos de Documentos"
        description="Gerencie tipos de documento com a mesma consistência visual das listagens já modernizadas."
        action={
          <Button className={listingPrimaryButtonClassName} onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Tipo de Documento
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="flex gap-4 items-end rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-slate-700">Descrição</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filtrar por descrição..."
                value={searchDescricao}
                onChange={(e) => setSearchDescricao(e.target.value)}
                className={`${listingFilterFieldClassName} pl-10`}
              />
            </div>
          </div>
          <Button className={listingSecondaryButtonClassName} onClick={clearFilters}>
            <X className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
      </ListingFilterCard>

      <ListingTableCard>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead 
                  className={`${listingTableHeadClassName} w-[120px] cursor-pointer hover:bg-slate-100/70`}
                  onClick={() => handleSort('codigo')}
                >
                  <div className="flex items-center">
                    Código
                    {getSortIcon('codigo')}
                  </div>
                </TableHead>
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
                  onClick={() => handleSort('mascara')}
                >
                  <div className="flex items-center">
                    Máscara
                    {getSortIcon('mascara')}
                  </div>
                </TableHead>
                <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTiposDocumento.map((tipoDocumento: any) => (
                <TableRow key={tipoDocumento.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <TableCell className={`${listingTableCellClassName} font-mono font-medium text-slate-800`}>
                    {tipoDocumento.codigo}
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                    {tipoDocumento.descricao}
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} font-mono`}>
                    {tipoDocumento.mascara}
                  </TableCell>
                  <TableCell className={`${listingTableCellClassName} text-right`}>
                    <div className="flex justify-end gap-2">
                      <FinanceActionButton icon={Edit} title="Editar" onClick={() => handleEdit(tipoDocumento)} tone="brand" />
                      <FinanceActionButton icon={Trash2} title="Excluir" onClick={() => handleDelete(tipoDocumento.id, tipoDocumento.descricao)} tone="danger" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedTiposDocumento.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="px-4">
                    <ListingEmptyState
                      icon={FileText}
                      title="Nenhum tipo de documento cadastrado"
                      description="Crie o primeiro tipo de documento para começar."
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
