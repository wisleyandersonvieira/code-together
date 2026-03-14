'use client';

import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Edit, 
  Trash2, 
  Plus,
  Package,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X
} from 'lucide-react';
import { ProductForm } from './ProductForm';
import { useToast } from '@/hooks/use-toast';
import loadProdutosAction from '@/actions/loadProdutos';
import deleteProdutoAction from '@/actions/deleteProduto';
import checkProdutoUsageAction from '@/actions/checkProdutoUsage';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import loadSubgruposByGrupoAction from '@/actions/loadSubgruposByGrupo';
import { FinanceActionButton } from '@/components/finance/listing-ui';

type SortColumn = 'codigo' | 'descricao' | 'tipo' | 'grupo_descricao' | 'subgrupo_descricao';
type SortDirection = 'asc' | 'desc';

export function ProductList() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Filters
  const [searchDescricao, setSearchDescricao] = useState('');
  const [searchGrupo, setSearchGrupo] = useState<string>('');
  const [searchSubgrupo, setSearchSubgrupo] = useState<string>('');

  const [produtos, loading, error, refreshProdutos] = useLoadAction(loadProdutosAction, [], {
    searchDescricao: searchDescricao || null,
    searchGrupo: searchGrupo ? parseInt(searchGrupo) : null,
    searchSubgrupo: searchSubgrupo ? parseInt(searchSubgrupo) : null,
  });
  const [grupos] = useLoadAction(loadGruposContabeisAction, []);
  const [subgrupos] = useLoadAction(loadSubgruposByGrupoAction, [], { 
    grupo_id: searchGrupo ? parseInt(searchGrupo) : null 
  });
  const [deleteProduto] = useMutateAction(deleteProdutoAction);
  const [checkProdutoUsage] = useMutateAction(checkProdutoUsageAction);

  const handleEdit = (produto: any) => {
    setEditingProduct(produto);
    setShowForm(true);
  };

  const handleDelete = async (id: number, descricao: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${descricao}"?`)) {
      return;
    }

    try {
      const result = await deleteProduto({ id });
      console.log('Delete result:', result);
      
      if (result && result.length > 0) {
        toast({
          title: "Produto excluído",
          description: "O produto/serviço foi excluído com sucesso.",
        });
        refreshProdutos();
      } else {
        // Check for dependencies using checkProdutoUsage
        const usageResult = await checkProdutoUsage({ id });
        console.log('Usage check result:', usageResult);
        
        const totalUsage = usageResult.reduce((sum: number, item: any) => sum + parseInt(item.count), 0);
        
        if (totalUsage > 0) {
          const contasPagarCount = usageResult.find((item: any) => item.table_name === 'contas_pagar_itens')?.count || 0;
          const contasReceberCount = usageResult.find((item: any) => item.table_name === 'contas_receber_itens')?.count || 0;
          
          toast({
            title: "Não foi possível excluir",
            description: `Este produto possui ${contasPagarCount} lançamento(s) em contas a pagar e ${contasReceberCount} lançamento(s) em contas a receber.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro",
            description: "Produto não encontrado ou não foi possível excluir.",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error('Error deleting produto:', error);
      toast({
        title: "Erro",
        description: `Erro ao excluir produto: ${error?.message || 'Erro desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProduct(null);
    refreshProdutos();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleGrupoFilterChange = (value: string) => {
    setSearchGrupo(value === 'all' ? '' : value);
    setSearchSubgrupo(''); // Reset subgrupo when grupo changes
  };

  const clearFilters = () => {
    setSearchDescricao('');
    setSearchGrupo('');
    setSearchSubgrupo('');
  };

  const handleSubgrupoFilterChange = (value: string) => {
    setSearchSubgrupo(value === 'all' ? '' : value);
  };

  const sortedProdutos = useMemo(() => {
    if (!produtos || produtos.length === 0) return [];
    
    const sorted = [...produtos].sort((a, b) => {
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
        case 'tipo':
          valueA = a.tipo?.toLowerCase() || '';
          valueB = b.tipo?.toLowerCase() || '';
          break;
        case 'grupo_descricao':
          valueA = a.grupo_descricao?.toLowerCase() || '';
          valueB = b.grupo_descricao?.toLowerCase() || '';
          break;
        case 'subgrupo_descricao':
          valueA = a.subgrupo_descricao?.toLowerCase() || '';
          valueB = b.subgrupo_descricao?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [produtos, sortColumn, sortDirection]);

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
      <ProductForm
        produto={editingProduct}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando produtos/serviços...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Erro ao carregar produtos/serviços: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Produtos/Serviços</h2>
          <p className="text-muted-foreground">
            Gerencie os produtos e serviços cadastrados
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto/Serviço
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Descrição</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por descrição..."
                  value={searchDescricao}
                  onChange={(e) => setSearchDescricao(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-1 block">Grupo</label>
              <Select value={searchGrupo || 'all'} onValueChange={handleGrupoFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {grupos.map((grupo: any) => (
                    <SelectItem key={grupo.id} value={grupo.id.toString()}>
                      {grupo.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-1 block">Subgrupo</label>
              <Select value={searchSubgrupo || 'all'} onValueChange={handleSubgrupoFilterChange} disabled={!searchGrupo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os subgrupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os subgrupos</SelectItem>
                  {subgrupos.map((subgrupo: any) => (
                    <SelectItem key={subgrupo.id} value={subgrupo.id.toString()}>
                      {subgrupo.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 w-[120px]"
                  onClick={() => handleSort('codigo')}
                >
                  <div className="flex items-center">
                    Código
                    {getSortIcon('codigo')}
                  </div>
                </TableHead>
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
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('grupo_descricao')}
                >
                  <div className="flex items-center">
                    Grupo
                    {getSortIcon('grupo_descricao')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('subgrupo_descricao')}
                >
                  <div className="flex items-center">
                    Subgrupo
                    {getSortIcon('subgrupo_descricao')}
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProdutos.map((produto: any) => (
                <TableRow key={produto.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono font-medium">
                    {produto.codigo}
                  </TableCell>
                  <TableCell className="font-medium">
                    {produto.descricao}
                  </TableCell>
                  <TableCell>
                    <Badge variant={produto.tipo === 'Produto' ? 'default' : 'secondary'}>
                      {produto.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {produto.grupo_descricao}
                  </TableCell>
                  <TableCell>
                    {produto.subgrupo_descricao}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <FinanceActionButton
                        icon={Edit}
                        title="Editar"
                        onClick={() => handleEdit(produto)}
                        tone="brand"
                      />
                      <FinanceActionButton
                        icon={Trash2}
                        title="Excluir"
                        onClick={() => handleDelete(produto.id, produto.descricao)}
                        tone="danger"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sortedProdutos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
                      <p className="text-muted-foreground mb-4">
                        Comece criando seu primeiro produto/serviço.
                      </p>
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeiro produto/serviço
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
