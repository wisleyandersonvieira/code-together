'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FileText, TrendingDown, TrendingUp, Filter, Calendar, Download, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import { useCurrency } from '@/hooks/use-currency';
import { exportToExcel, exportToPDF, exportChartsOnlyToPDF } from '@/utils/export';
import loadRelatorioClienteDespesasAction from '@/actions/loadRelatorioClienteDespesas';
import loadRelatorioClienteReceitasAction from '@/actions/loadRelatorioClienteReceitas';
import loadClientesAction from '@/actions/loadClientes';
import loadProjetosAction from '@/actions/loadProjetos';
import loadContasAction from '@/actions/loadContas';
import loadProjetoEvolucaoOrcamentoAction from '@/actions/loadProjetoEvolucaoOrcamento';
import loadProjetoEvolucaoAportesAction from '@/actions/loadProjetoEvolucaoAportes';
import loadRelatorioProjetoDespesasPorGrupoAction from '@/actions/loadRelatorioProjetoDespesasPorGrupo';
import loadRelatorioProjetoReceitasPorClienteAction from '@/actions/loadRelatorioProjetoReceitasPorCliente';

export function RelatorioCliente() {
  const { formatCurrency } = useCurrency();
  const [filtros, setFiltros] = useState({
    projetoId: null as number | null,
    contaId: null as number | null,
    situacaoPagamento: null as string | null,
    dataVencimentoInicio: null as string | null,
    dataVencimentoFim: null as string | null,
    dataPagamentoInicio: null as string | null,
    dataPagamentoFim: null as string | null,
  });

  const [projetos] = useLoadAction(loadProjetosAction, []);
  const [contas] = useLoadAction(loadContasAction, []);
  
  // Dados para o quadro de evolução quando apenas um projeto selecionado
  const [orcamentoData] = useLoadAction(
    loadProjetoEvolucaoOrcamentoAction,
    [],
    { projetoId: filtros.projetoId || null }
  );
  
  const [aportesData] = useLoadAction(
    loadProjetoEvolucaoAportesAction,
    [],
    { projetoId: filtros.projetoId || null }
  );
  
  // Dados para gráficos
  const [despesasPorGrupo] = useLoadAction(
    loadRelatorioProjetoDespesasPorGrupoAction,
    [],
    { projetoId: filtros.projetoId || null }
  );
  
  const [receitasPorCliente] = useLoadAction(
    loadRelatorioProjetoReceitasPorClienteAction,
    [],
    { projetoId: filtros.projetoId || null }
  );
  
  const [despesas, loadingDespesas] = useLoadAction(
    loadRelatorioClienteDespesasAction, 
    [], 
    {
      projetoId: filtros.projetoId || null,
      contaId: filtros.contaId || null,
      situacaoPagamento: filtros.situacaoPagamento || null,
      dataVencimentoInicio: filtros.dataVencimentoInicio || null,
      dataVencimentoFim: filtros.dataVencimentoFim || null,
      dataPagamentoInicio: filtros.dataPagamentoInicio || null,
      dataPagamentoFim: filtros.dataPagamentoFim || null,
    }
  );

  const [receitas, loadingReceitas] = useLoadAction(
    loadRelatorioClienteReceitasAction, 
    [], 
    {
      clienteId: null,
      projetoId: filtros.projetoId || null,
      contaId: filtros.contaId || null,
      situacaoPagamento: filtros.situacaoPagamento || null,
      dataVencimentoInicio: filtros.dataVencimentoInicio || null,
      dataVencimentoFim: filtros.dataVencimentoFim || null,
      dataPagamentoInicio: filtros.dataPagamentoInicio || null,
      dataPagamentoFim: filtros.dataPagamentoFim || null,
    }
  );

  const handleFiltroChange = (campo: string, valor: any) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor === 'todos' || valor === 'todas' || valor === 'todas' ? null : valor
    }));
  };

  const limparFiltros = () => {
    setFiltros({
      projetoId: null,
      contaId: null,
      situacaoPagamento: null,
      dataVencimentoInicio: null,
      dataVencimentoFim: null,
      dataPagamentoInicio: null,
      dataPagamentoFim: null,
    });
  };

  // Calculate totals
  const totalDespesas = despesas.filter(item => item.situacao_pagamento === 'Pendente').reduce((sum, item) => sum + (item.valor || 0), 0);
  const totalReceitas = receitas.filter(item => item.situacao_pagamento === 'Pendente').reduce((sum, item) => sum + (item.valor || 0), 0);
  const totalQuitadoDespesas = despesas.filter(item => item.situacao_pagamento === 'Quitada').reduce((sum, item) => sum + (item.valor || 0), 0);
  const totalQuitadoReceitas = receitas.filter(item => item.situacao_pagamento === 'Quitada').reduce((sum, item) => sum + (item.valor || 0), 0);

  const getStatusBadge = (situacao: string) => {
    return situacao === 'Quitada' 
      ? <Badge className="bg-green-100 text-green-800">Quitada</Badge>
      : <Badge variant="destructive">Pendente</Badge>;
  };

  const formatDate = (date: string | null) => {
    return date ? new Date(date).toLocaleDateString() : '-';
  };

  const handleExportDespesas = (format: 'excel' | 'pdf') => {
    if (despesas.length === 0) return;
    
    const filename = `despesas-relatorio-${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'excel') {
      exportToExcel(despesas, filename, 'despesas', formatCurrency);
    } else {
      const projetoSelecionado = filtros.projetoId ? projetos.find((p: any) => p.id === filtros.projetoId) : null;
      exportToPDF(
        despesas,
        receitas,
        filename, 
        formatCurrency,
        filtros,
        projetoSelecionado,
        filtros.projetoId ? orcamentoData : undefined,
        filtros.projetoId ? aportesData : undefined
      );
    }
  };

  const handleExportReceitas = (format: 'excel' | 'pdf') => {
    if (receitas.length === 0) return;
    
    const filename = `receitas-relatorio-${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'excel') {
      exportToExcel(receitas, filename, 'receitas', formatCurrency);
    } else {
      const projetoSelecionado = filtros.projetoId ? projetos.find((p: any) => p.id === filtros.projetoId) : null;
      exportToPDF(
        despesas,
        receitas,
        filename, 
        formatCurrency,
        filtros,
        projetoSelecionado,
        filtros.projetoId ? orcamentoData : undefined,
        filtros.projetoId ? aportesData : undefined
      );
    }
  };

  const handleExportCharts = () => {
    if (!filtros.projetoId) return;
    
    const projetoSelecionado = projetos.find((p: any) => p.id === filtros.projetoId);
    if (!projetoSelecionado) return;
    
    const filename = `graficos-${projetoSelecionado.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
    
    exportChartsOnlyToPDF(
      despesasPorGrupo,
      receitasPorCliente,
      filename,
      formatCurrency,
      projetoSelecionado
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatório por Projeto
            </CardTitle>
            {filtros.projetoId && (
              <Button
                variant="default"
                size="sm"
                onClick={handleExportCharts}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Gráfico
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Projeto</label>
              <Select 
                value={filtros.projetoId?.toString() || 'todos'} 
                onValueChange={(value) => handleFiltroChange('projetoId', value === 'todos' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os projetos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os projetos</SelectItem>
                  {projetos.map((projeto: any) => (
                    <SelectItem key={projeto.id} value={projeto.id.toString()}>
                      {projeto.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Conta Corrente</label>
              <Select 
                value={filtros.contaId?.toString() || 'todas'} 
                onValueChange={(value) => handleFiltroChange('contaId', value === 'todas' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas</SelectItem>
                  {contas.map((conta: any) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Situação</label>
              <Select 
                value={filtros.situacaoPagamento || 'todas'} 
                onValueChange={(value) => handleFiltroChange('situacaoPagamento', value === 'todas' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="quitado">Quitado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={limparFiltros} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Filtros de Data */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Data Vencimento - Início</label>
              <Input
                type="date"
                value={filtros.dataVencimentoInicio || ''}
                onChange={(e) => handleFiltroChange('dataVencimentoInicio', e.target.value || null)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Vencimento - Fim</label>
              <Input
                type="date"
                value={filtros.dataVencimentoFim || ''}
                onChange={(e) => handleFiltroChange('dataVencimentoFim', e.target.value || null)}
                className="w-full"
              />
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
          </div>
        </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Despesas Pendentes</p>
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
                    <p className="text-sm text-muted-foreground">Receitas Pendentes</p>
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
                    <p className="text-sm text-muted-foreground">Despesas Quitadas</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalQuitadoDespesas)}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Receitas Quitadas</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalQuitadoReceitas)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Despesas and Receitas */}
          <Tabs defaultValue="despesas" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="despesas" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Despesas ({despesas.length})
              </TabsTrigger>
              <TabsTrigger value="receitas" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Receitas ({receitas.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="despesas">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Despesas</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportDespesas('excel')}
                      disabled={despesas.length === 0}
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportDespesas('pdf')}
                      disabled={despesas.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingDespesas ? (
                    <div className="text-center py-8">Carregando despesas...</div>
                  ) : despesas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma despesa encontrada com os filtros aplicados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data Vencimento</TableHead>
                            <TableHead>Data Pagamento</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Projeto</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Conta Corrente</TableHead>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Situação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {despesas.map((despesa: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{formatDate(despesa.data_vencimento)}</TableCell>
                              <TableCell>{formatDate(despesa.data_pagamento)}</TableCell>
                              <TableCell>{despesa.fornecedor_nome}</TableCell>
                              <TableCell>{despesa.projeto_nome}</TableCell>
                              <TableCell className="font-mono">{formatCurrency(despesa.valor)}</TableCell>
                              <TableCell>{despesa.conta_nome || '-'}</TableCell>
                              <TableCell>
                                {despesa.parcela}/{despesa.total_parcelas}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(despesa.situacao_pagamento)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="receitas">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Receitas</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportReceitas('excel')}
                      disabled={receitas.length === 0}
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportReceitas('pdf')}
                      disabled={receitas.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingReceitas ? (
                    <div className="text-center py-8">Carregando receitas...</div>
                  ) : receitas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma receita encontrada com os filtros aplicados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Data Vencimento</TableHead>
                            <TableHead>Data Recebimento</TableHead>
                            <TableHead>Projeto</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Conta Corrente</TableHead>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Situação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receitas.map((receita: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{receita.cliente_nome}</TableCell>
                              <TableCell>{formatDate(receita.data_vencimento)}</TableCell>
                              <TableCell>{formatDate(receita.data_recebimento)}</TableCell>
                              <TableCell>{receita.projeto_nome}</TableCell>
                              <TableCell className="font-mono">{formatCurrency(receita.valor)}</TableCell>
                              <TableCell>{receita.conta_nome || '-'}</TableCell>
                              <TableCell>
                                {receita.parcela}/{receita.total_parcelas}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(receita.situacao_pagamento)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
