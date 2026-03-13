'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Filter, Calendar, DollarSign, FileDown } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, formatDateForDisplay } from '@/utils/timezone';
import { exportExtratoBancarioPDF } from '@/utils/export';
import loadContasAction from '@/actions/loadContas';
import loadExtratoAction from '@/actions/loadExtrato';
import loadSaldoAnteriorAction from '@/actions/loadSaldoAnterior';
import loadMatrizesAction from '@/actions/loadMatrizes';


interface ExtratoTransaction {
  data: string;
  fornecedor_creditor: string;
  numero_documento?: string;
  projeto?: string;
  valor: number;
  tipo: 'CP' | 'CR' | 'TR' | 'APORTE' | 'RETIRADA';
  matriz_nome?: string;
}

interface SaldoAnterior {
  saldo_anterior: number;
  conta_nome: string;
  conta_banco: string;
  data_saldo_inicial: string;
}

export function ExtratoBancario() {
  const { formatCurrency } = useCurrency();
  const [contas] = useLoadAction(loadContasAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });

  
  // Filter state
  const [contaId, setContaId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<Date | null>(null);
  const [dataFim, setDataFim] = useState<Date | null>(null);
  const [tipo, setTipo] = useState<string>('');
  const [matrizId, setMatrizId] = useState<string>('');
  const [showExtrato, setShowExtrato] = useState(false);
  
  // Data loading - corrigindo parâmetro de condição
  const [transacoes, transacoesLoading, transacoesError] = useLoadAction(
    loadExtratoAction,
    [],
    {
      contaId: contaId ? parseInt(contaId) : null,
      dataInicio: dataInicio ? formatDateForDatabase(dataInicio) : null,
      dataFim: dataFim ? formatDateForDatabase(dataFim) : null,
      tipo: tipo || null,
      matrizId: matrizId ? parseInt(matrizId) : null,
    }
  );

  const [saldoData, saldoLoading] = useLoadAction(
    loadSaldoAnteriorAction,
    [],
    {
      contaId: contaId ? parseInt(contaId) : null,
      dataInicio: dataInicio ? formatDateForDatabase(dataInicio) : null,
    }
  );

  const handleGenerateExtrato = () => {
    if (!contaId || !dataInicio || !dataFim) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    if (dataFim < dataInicio) {
      alert('A data final deve ser posterior à data inicial.');
      return;
    }
    
    setShowExtrato(true);
  };

  const handleDownloadExtrato = () => {
    if (!transacoes || transacoes.length === 0) return;
    
    const saldoAnterior = saldoData?.[0]?.saldo_anterior || 0;
    const conta = saldoData?.[0];
    
    // Generate CSV content
    let csvContent = `Extrato Bancário\n`;
    csvContent += `Conta: ${conta?.conta_nome || ''} - ${conta?.conta_banco || ''}\n`;
    csvContent += `Período: ${dataInicio?.toLocaleDateString('pt-BR')} a ${dataFim?.toLocaleDateString('pt-BR')}\n`;
    csvContent += `Saldo Anterior: ${formatCurrency(saldoAnterior)}\n\n`;
    csvContent += `Data,Tipo,Fornecedor/Credor,Número Documento,Projeto,Matriz,Valor,Saldo\n`;
    
    let saldoAcumulado = saldoAnterior;
    transacoes.forEach((transacao: ExtratoTransaction) => {
      saldoAcumulado += transacao.valor;
      csvContent += `"${formatDateForDisplay(transacao.data)}",`;
      csvContent += `"${transacao.tipo || ''}",`;
      csvContent += `"${transacao.fornecedor_creditor || ''}",`;
      csvContent += `"${transacao.numero_documento || ''}",`;
      csvContent += `"${transacao.projeto || ''}",`;
      csvContent += `"${transacao.matriz_nome || ''}",`;
      csvContent += `"${formatCurrency(transacao.valor)}",`;
      csvContent += `"${formatCurrency(saldoAcumulado)}"\n`;
    });
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_${conta?.conta_nome}_${dataInicio ? formatDateForDatabase(dataInicio) : 'inicio'}_${dataFim ? formatDateForDatabase(dataFim) : 'fim'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    if (!transacoes || transacoes.length === 0) {
      alert('Nenhum dado disponível para gerar PDF.');
      return;
    }
    
    const conta = saldoData?.[0];
    if (!conta) {
      alert('Informações da conta não disponíveis.');
      return;
    }
    
    const contaInfo = {
      conta_nome: conta.conta_nome || 'N/A',
      conta_banco: conta.conta_banco || 'N/A',
      saldo_anterior: conta.saldo_anterior || 0,
    };
    
    const filtrosInfo = {
      dataInicio: dataInicio?.toLocaleDateString('pt-BR') || '',
      dataFim: dataFim?.toLocaleDateString('pt-BR') || '',
      tipo: tipo || undefined,
      matrizNome: matrizId ? matrizes.find((m: any) => m.id === parseInt(matrizId))?.nome : undefined,
    };
    
    const filename = `extrato_${conta.conta_nome?.replace(/[^a-zA-Z0-9]/g, '_') || 'conta'}_${dataInicio ? formatDateForDatabase(dataInicio) : 'inicio'}_${dataFim ? formatDateForDatabase(dataFim) : 'fim'}`;
    
    exportExtratoBancarioPDF(
      transacoesComSaldo,
      filename,
      contaInfo,
      filtrosInfo,
      formatCurrency,
      formatDateForDisplay
    );
  };

  const calculateRunningBalance = () => {
    if (!transacoes || !saldoData?.[0]) return [];
    
    // Saldo anterior considera todas as movimentações até o dia anterior ao período
    const saldoAnterior = saldoData[0].saldo_anterior || 0;
    let saldoAcumulado = saldoAnterior;
    
    // Calcula saldo acumulado linha por linha durante o período
    return transacoes.map((transacao: ExtratoTransaction) => {
      saldoAcumulado += transacao.valor;
      return {
        ...transacao,
        saldo_linha: saldoAcumulado,
      };
    });
  };

  const transacoesComSaldo = calculateRunningBalance();
  const saldoFinal = transacoesComSaldo.length > 0 
    ? transacoesComSaldo[transacoesComSaldo.length - 1].saldo_linha 
    : (saldoData?.[0]?.saldo_anterior || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Extratos Bancários</h2>
          <p className="text-muted-foreground">
            Visualize o extrato detalhado de movimentações financeiras por conta
          </p>
        </div>
      </div>



      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Parâmetros do Extrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Conta *</label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((conta: any) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.nome} - {conta.banco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Inicial *</label>
              <DatePicker
                date={dataInicio}
                onDateChange={setDataInicio}
                placeholder="Selecione a data inicial"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Data Final *</label>
              <DatePicker
                date={dataFim}
                onDateChange={setDataFim}
                placeholder="Selecione a data final"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select value={tipo || 'ALL'} onValueChange={(value) => setTipo(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os tipos</SelectItem>
                  <SelectItem value="CP">Contas a Pagar</SelectItem>
                  <SelectItem value="CR">Contas a Receber</SelectItem>
                  <SelectItem value="TR">Transferências</SelectItem>
                  <SelectItem value="APORTE">Aportes</SelectItem>
                  <SelectItem value="RETIRADA">Retiradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Matriz</label>
              <Select value={matrizId || 'ALL'} onValueChange={(value) => setMatrizId(value === 'ALL' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as matrizes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as matrizes</SelectItem>
                  {matrizes.map((matriz: any) => (
                    <SelectItem key={matriz.id} value={matriz.id.toString()}>
                      {matriz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateExtrato}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Extrato
            </Button>
            {showExtrato && transacoes && transacoes.length > 0 && (
              <>
                <Button variant="outline" onClick={handleDownloadExtrato}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button variant="outline" onClick={handleDownloadPDF}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extrato */}
      {showExtrato && contaId && dataInicio && dataFim && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Extrato Detalhado
              </CardTitle>
              {saldoData?.[0] && (
                <Badge variant="outline" className="text-lg px-3 py-1">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Saldo Final: {formatCurrency(saldoFinal)}
                </Badge>
              )}
            </div>
            {saldoData?.[0] && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Conta:</strong> {saldoData[0].conta_nome} - {saldoData[0].conta_banco}</p>
                <p><strong>Período:</strong> {dataInicio?.toLocaleDateString('pt-BR')} a {dataFim?.toLocaleDateString('pt-BR')}</p>
                <p><strong>Saldo Anterior:</strong> {formatCurrency(saldoData[0].saldo_anterior || 0)}</p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {transacoesLoading || saldoLoading ? (
              <div className="text-center py-8">Carregando extrato...</div>
            ) : transacoesError ? (
              <div className="text-center py-8 text-red-500">Erro ao carregar extrato</div>
            ) : !transacoes || transacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma movimentação encontrada para o período selecionado.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fornecedor/Credor</TableHead>
                      <TableHead>Nº Documento</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Matriz</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transacoesComSaldo.map((transacao: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {formatDateForDisplay(transacao.data)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {transacao.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{transacao.fornecedor_creditor}</TableCell>
                        <TableCell>{transacao.numero_documento || '-'}</TableCell>
                        <TableCell>{transacao.projeto || '-'}</TableCell>
                        <TableCell>{transacao.matriz_nome || '-'}</TableCell>
                        <TableCell className="text-right">
                          <span className={transacao.valor < 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(transacao.valor)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transacao.saldo_linha)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
