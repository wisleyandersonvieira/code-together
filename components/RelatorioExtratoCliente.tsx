'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileText, Filter, Download, FileSpreadsheet, UserCheck, Building, Building2, Search } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import { useCurrency } from '@/hooks/use-currency';
import { exportExtratoClientePDF, exportExtratoClienteExcel } from '@/utils/export';
import loadExtratoClienteAction from '@/actions/loadExtratoCliente';
import loadClientesAction from '@/actions/loadClientes';
import loadEmpresasAction from '@/actions/loadEmpresas';
import loadGruposAction from '@/actions/loadGrupos';
import loadProjetosAction from '@/actions/loadProjetos';
import loadContasAction from '@/actions/loadContas';

interface ExtratoClienteResultsProps {
  filtros: {
    entityType: string | null;
    entityId: number | null;
    projetoIds: number[];
    contaId: number | null;
    dataInicio: string | null;
    dataFim: string | null;
  };
  projetos: any[];
  getEntityName: () => string;
}

function ExtratoClienteResults({ filtros, projetos, getEntityName }: ExtratoClienteResultsProps) {
  const { formatCurrency } = useCurrency();
  
  const [contas] = useLoadAction(loadContasAction, []);
  
  const params = {
    entityType: filtros.entityType || null,
    entityId: filtros.entityId || null,
    projetoIds: filtros.projetoIds.length > 0 ? filtros.projetoIds[0] : null,
    contaId: filtros.contaId || null,
    dataInicio: filtros.dataInicio || null,
    dataFim: filtros.dataFim || null,
  };

  console.log('Parâmetros do extrato cliente:', params);
  
  const [extrato, loadingExtrato] = useLoadAction(
    loadExtratoClienteAction, 
    [], 
    params
  );

  console.log('Resultado do extrato cliente:', extrato, 'Loading:', loadingExtrato);

  const totalExtrato = extrato.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);

  const formatDate = (date: string | null) => {
    return date ? new Date(date).toLocaleDateString() : '-';
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    if (extrato.length === 0) return;
    
    const clienteNome = getEntityName();
    const filename = `extrato-cliente-${clienteNome.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'excel') {
      exportExtratoClienteExcel(extrato, filename, clienteNome, formatCurrency);
    } else {
      const projetoNome = filtros.projetoIds.length > 0 
        ? projetos.find((p: any) => p.id === filtros.projetoIds[0])?.name 
        : undefined;
      const contaNome = filtros.contaId 
        ? contas.find((c: any) => c.id === filtros.contaId)?.nome 
        : undefined;
      
      exportExtratoClientePDF(
        extrato,
        filename,
        clienteNome,
        {
          projetoNome,
          contaNome,
          dataInicio: filtros.dataInicio,
          dataFim: filtros.dataFim,
        },
        formatCurrency
      );
    }
  };

  return (
    <>
      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Extrato de: {getEntityName()}
                {filtros.projetoIds.length > 0 && (
                  <span> • Projeto: {projetos.find((p: any) => p.id === filtros.projetoIds[0])?.name}</span>
                )}
              </p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalExtrato)}</p>
              <p className="text-sm text-muted-foreground">{extrato.length} movimentação(ões)</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('excel')}
                disabled={extrato.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={extrato.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extrato Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Extrato de Recebimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingExtrato ? (
            <div className="text-center py-8">Carregando extrato...</div>
          ) : extrato.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação encontrada com os filtros aplicados.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data de Pagamento</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Conta Corrente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extrato.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(item.data_pagamento)}</TableCell>
                        <TableCell className="font-medium">{item.projeto_nome || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {formatCurrency(parseFloat(item.valor))}
                        </TableCell>
                        <TableCell>{item.conta_corrente || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Total Row */}
              <div className="border-t mt-4 pt-4">
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total:</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(totalExtrato)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function RelatorioExtratoCliente() {
  const [filtros, setFiltros] = useState({
    entityType: null as string | null,
    entityId: null as number | null,
    projetoIds: [] as number[],
    contaId: null as number | null,
    dataInicio: null as string | null,
    dataFim: null as string | null,
  });

  const [showResults, setShowResults] = useState(false);

  const [clientes] = useLoadAction(loadClientesAction, []);
  const [empresas] = useLoadAction(loadEmpresasAction, []);
  const [grupos] = useLoadAction(loadGruposAction, []);
  const [projetos] = useLoadAction(loadProjetosAction, []);
  const [contas] = useLoadAction(loadContasAction, []);

  const handleFiltroChange = (campo: string, valor: any) => {
    if (campo === 'entityType') {
      setFiltros(prev => ({
        ...prev,
        entityType: valor === 'selecione' ? null : valor,
        entityId: null, // Reset entity selection when type changes
      }));
    } else {
      setFiltros(prev => ({
        ...prev,
        [campo]: valor === 'todos' || valor === 'todas' || valor === 'selecione' ? null : valor
      }));
    }
  };

  const limparFiltros = () => {
    setFiltros({
      entityType: null,
      entityId: null,
      projetoIds: [],
      contaId: null,
      dataInicio: null,
      dataFim: null,
    });
    setShowResults(false);
  };

  const getEntityOptions = () => {
    switch (filtros.entityType) {
      case 'cliente':
        return clientes;
      case 'empresa':
        return empresas;
      case 'grupo':
        return grupos;
      default:
        return [];
    }
  };

  const getEntityName = () => {
    if (!filtros.entityType || !filtros.entityId) return 'Nenhum selecionado';
    
    const options = getEntityOptions();
    const entity = options.find((item: any) => item.id === filtros.entityId);
    return entity?.name || 'Não encontrado';
  };

  const canGenerateReport = filtros.entityType && filtros.entityId;

  const handleGenerateReport = () => {
    if (canGenerateReport) {
      console.log('Gerando extrato com filtros:', filtros);
      console.log('EntityType:', filtros.entityType, 'EntityId:', filtros.entityId);
      setShowResults(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extrato do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="space-y-4 mb-6">
            {/* Seleção de Tipo de Entidade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo *</label>
                <Select 
                  value={filtros.entityType || 'selecione'} 
                  onValueChange={(value) => handleFiltroChange('entityType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selecione">Selecione o tipo</SelectItem>
                    <SelectItem value="cliente">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Cliente
                      </div>
                    </SelectItem>
                    <SelectItem value="empresa">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Empresa
                      </div>
                    </SelectItem>
                    <SelectItem value="grupo">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Grupo
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {filtros.entityType === 'cliente' ? 'Cliente *' : 
                   filtros.entityType === 'empresa' ? 'Empresa *' : 
                   filtros.entityType === 'grupo' ? 'Grupo *' : 'Entidade *'}
                </label>
                <Select 
                  value={filtros.entityId?.toString() || 'selecione'} 
                  onValueChange={(value) => handleFiltroChange('entityId', value === 'selecione' ? null : parseInt(value))}
                  disabled={!filtros.entityType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selecione">Selecione...</SelectItem>
                    {getEntityOptions().map((entity: any) => (
                      <SelectItem key={entity.id} value={entity.id.toString()}>
                        {entity.name}
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
            </div>

            {/* Filtros de Data e Projeto */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Projeto</label>
                <Select 
                  value={filtros.projetoIds.length === 0 ? 'todos' : filtros.projetoIds[0]?.toString() || 'todos'} 
                  onValueChange={(value) => {
                    if (value === 'todos') {
                      setFiltros(prev => ({ ...prev, projetoIds: [] }));
                    } else {
                      setFiltros(prev => ({ ...prev, projetoIds: [parseInt(value)] }));
                    }
                  }}
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
                <label className="text-sm font-medium mb-2 block">Data Pagamento - Início</label>
                <Input
                  type="date"
                  value={filtros.dataInicio || ''}
                  onChange={(e) => handleFiltroChange('dataInicio', e.target.value || null)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data Pagamento - Fim</label>
                <Input
                  type="date"
                  value={filtros.dataFim || ''}
                  onChange={(e) => handleFiltroChange('dataFim', e.target.value || null)}
                  className="w-full"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={limparFiltros} className="flex-1">
                  <Filter className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
                <Button 
                  onClick={handleGenerateReport} 
                  disabled={!canGenerateReport}
                  className="flex-1"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Gerar Extrato
                </Button>
              </div>
            </div>
          </div>

          {!showResults ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">
                {!canGenerateReport ? 'Selecione um cliente, empresa ou grupo' : 'Clique em "Gerar Extrato"'}
              </p>
              <p className="text-sm">
                {!canGenerateReport 
                  ? 'Para visualizar o extrato, primeiro selecione o tipo e a entidade.' 
                  : 'Configure os filtros desejados e clique no botão para gerar o relatório.'
                }
              </p>
            </div>
          ) : (
            <ExtratoClienteResults 
              filtros={filtros}
              projetos={projetos}
              getEntityName={getEntityName}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
