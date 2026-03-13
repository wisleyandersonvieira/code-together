'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, FileText, TrendingDown, TrendingUp, Filter, Calendar, Download, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import { useCurrency } from '@/hooks/use-currency';
import { exportRelatorioProjetosGeralPDF } from '@/utils/export';
import * as XLSX from 'xlsx';
import loadRelatorioProjetosGeralAction from '@/actions/loadRelatorioProjetosGeral';
import loadProjetosAction from '@/actions/loadProjetos';
import loadMatrizesAction from '@/actions/loadMatrizes';
import { useToast } from '@/hooks/use-toast';
import { formatDateForDatabase } from '@/utils/timezone';

export function RelatorioProjetosGeral() {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  
  const [filtros, setFiltros] = useState({
    projetoIds: [] as number[],
    matrizId: null as number | null,
    dataPagamentoInicio: null as string | null,
    dataPagamentoFim: null as string | null,
  });
  
  const [projetosDropdownOpen, setProjetosDropdownOpen] = useState(false);

  const [projetos] = useLoadAction(loadProjetosAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  
  const [dadosRelatorio, loading, error] = useLoadAction(
    loadRelatorioProjetosGeralAction, 
    [], 
    {
      projetoIds: filtros.projetoIds || [],
      matrizId: filtros.matrizId || null,
      dataPagamentoInicio: filtros.dataPagamentoInicio || null,
      dataPagamentoFim: filtros.dataPagamentoFim || null,
    }
  );

  const handleFiltroChange = (campo: string, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor === 'todos' || valor === '' ? null : valor
    }));
  };

  const limparFiltros = () => {
    setFiltros({
      projetoIds: [],
      matrizId: null,
      dataPagamentoInicio: null,
      dataPagamentoFim: null,
    });
  };

  const handleProjetoToggle = (projetoId: number) => {
    setFiltros(prev => ({
      ...prev,
      projetoIds: prev.projetoIds.includes(projetoId)
        ? prev.projetoIds.filter(id => id !== projetoId)
        : [...prev.projetoIds, projetoId]
    }));
  };

  const handleSelectAllProjetos = () => {
    const allProjetoIds = projetos.map((projeto: any) => projeto.id);
    setFiltros(prev => ({
      ...prev,
      projetoIds: prev.projetoIds.length === projetos.length ? [] : allProjetoIds
    }));
  };

  const getProjetosSelectedText = () => {
    if (filtros.projetoIds.length === 0) return "Nenhum projeto selecionado";
    if (filtros.projetoIds.length === projetos.length) return "Todos os projetos";
    if (filtros.projetoIds.length === 1) {
      const projeto = projetos.find((p: any) => p.id === filtros.projetoIds[0]);
      return projeto?.name || "1 projeto";
    }
    return `${filtros.projetoIds.length} projetos selecionados`;
  };

  // Calculate totals
  const totalReceitas = dadosRelatorio.reduce((sum: number, item: any) => sum + (item.valor_receitas || 0), 0);
  const totalDespesas = dadosRelatorio.reduce((sum: number, item: any) => sum + (item.valor_despesas || 0), 0);
  const saldoGeral = totalReceitas - totalDespesas;

  const handleExportExcel = () => {
    if (dadosRelatorio.length === 0) {
      toast({
        title: "Nenhum dado encontrado",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Preparar dados para Excel
      const excelData = dadosRelatorio.map((item: any) => ({
        'Projeto': item.projeto_nome || '',
        'Valor Receitas': formatCurrency(item.valor_receitas || 0),
        'Valor Despesas': formatCurrency(item.valor_despesas || 0),
        'Saldo': formatCurrency(item.saldo || 0),
      }));

      // Adicionar linha de totais
      excelData.push({
        'Projeto': 'TOTAL GERAL',
        'Valor Receitas': formatCurrency(totalReceitas),
        'Valor Despesas': formatCurrency(totalDespesas),
        'Saldo': formatCurrency(saldoGeral),
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 20 }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Projetos Geral');

      const filename = `relatorio-projetos-geral-${new Date().toISOString().split('T')[0]}`;
      XLSX.writeFile(wb, `${filename}.xlsx`);
      
      toast({
        title: "Excel exportado",
        description: "Relatório exportado com sucesso para Excel.",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar o relatório para Excel.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = () => {
    if (dadosRelatorio.length === 0) {
      toast({
        title: "Nenhum dado encontrado",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const filename = `relatorio-projetos-geral-${new Date().toISOString().split('T')[0]}`;
      
      exportRelatorioProjetosGeralPDF(
        dadosRelatorio,
        filename,
        formatCurrency,
        filtros,
        totalReceitas,
        totalDespesas,
        saldoGeral,
        projetos
      );
      
      toast({
        title: "PDF exportado",
        description: "Relatório exportado com sucesso para PDF.",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar o relatório para PDF.",
        variant: "destructive",
      });
    }
  };

  const getSaldoBadge = (saldo: number) => {
    if (saldo > 0) {
      return <Badge className="bg-green-100 text-green-800">Positivo</Badge>;
    } else if (saldo < 0) {
      return <Badge className="bg-red-100 text-red-800">Negativo</Badge>;
    } else {
      return <Badge variant="secondary">Equilibrado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório Projetos Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Matriz</label>
                <Select 
                  value={filtros.matrizId?.toString() || 'todos'} 
                  onValueChange={(value) => handleFiltroChange('matrizId', value === 'todos' ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as matrizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as matrizes</SelectItem>
                    {matrizes.map((matriz: any) => (
                      <SelectItem key={matriz.id} value={matriz.id.toString()}>
                        {matriz.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Projetos</label>
                <Popover open={projetosDropdownOpen} onOpenChange={setProjetosDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={projetosDropdownOpen}
                      className="w-full justify-between text-left font-normal"
                    >
                      {getProjetosSelectedText()}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        placeholder="Buscar projetos..."
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div className="max-h-60 overflow-auto">
                      <div className="flex items-center space-x-2 p-3 border-b">
                        <Checkbox 
                          id="select-all"
                          checked={filtros.projetoIds.length === projetos.length}
                          onCheckedChange={handleSelectAllProjetos}
                        />
                        <label 
                          htmlFor="select-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Selecionar todos
                        </label>
                      </div>
                      {projetos.map((projeto: any) => (
                        <div key={projeto.id} className="flex items-center space-x-2 p-3 hover:bg-gray-50">
                          <Checkbox 
                            id={`projeto-${projeto.id}`}
                            checked={filtros.projetoIds.includes(projeto.id)}
                            onCheckedChange={() => handleProjetoToggle(projeto.id)}
                          />
                          <label 
                            htmlFor={`projeto-${projeto.id}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                          >
                            {projeto.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Pagamento - Início</label>
                <Input
                  type="date"
                  value={filtros.dataPagamentoInicio || ''}
                  onChange={(e) => handleFiltroChange('dataPagamentoInicio', e.target.value || null)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Pagamento - Fim</label>
                <Input
                  type="date"
                  value={filtros.dataPagamentoFim || ''}
                  onChange={(e) => handleFiltroChange('dataPagamentoFim', e.target.value || null)}
                  className="w-full"
                />
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={limparFiltros} className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Receitas</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceitas)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Despesas</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDespesas)}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Geral</p>
                    <p className={`text-2xl font-bold ${saldoGeral >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(saldoGeral)}
                    </p>
                  </div>
                  <BarChart3 className={`h-8 w-8 ${saldoGeral >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dados da Tabela */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                Relatório por Projeto ({dadosRelatorio.length} projetos)
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={dadosRelatorio.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={dadosRelatorio.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando relatório...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">
                  Erro ao carregar relatório: {error.message}
                </div>
              ) : dadosRelatorio.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum projeto com movimentações encontrado com os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projeto</TableHead>
                        <TableHead className="text-right">Valor Receitas</TableHead>
                        <TableHead className="text-right">Valor Despesas</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosRelatorio.map((item: any) => (
                        <TableRow key={item.projeto_id}>
                          <TableCell className="font-medium">
                            {item.projeto_nome}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(item.valor_receitas)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatCurrency(item.valor_despesas)}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-bold ${item.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(item.saldo)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getSaldoBadge(item.saldo)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Linha de totais */}
                      <TableRow className="border-t-2 border-gray-300 bg-gray-50">
                        <TableCell className="font-bold">
                          TOTAL GERAL
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">
                          {formatCurrency(totalReceitas)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">
                          {formatCurrency(totalDespesas)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${saldoGeral >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(saldoGeral)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getSaldoBadge(saldoGeral)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
