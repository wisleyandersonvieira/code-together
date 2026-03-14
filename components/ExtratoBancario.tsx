'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { FileText, Download, Filter, Calendar, DollarSign, FileDown } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, formatDateForDisplay } from '@/utils/timezone';
import { exportExtratoBancarioPDF } from '@/utils/export';
import loadContasAction from '@/actions/loadContas';
import loadExtratoAction from '@/actions/loadExtrato';
import loadSaldoAnteriorAction from '@/actions/loadSaldoAnterior';
import loadMatrizesAction from '@/actions/loadMatrizes';
import {
  FinanceStatusBadge,
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';


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
      <ListingPageHeader
        title="Extratos Bancários"
        description="Visualize movimentações financeiras por conta com a mesma linguagem visual das demais listagens."
      />

      <ListingFilterCard>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="h-4 w-4" />
              Parâmetros do Extrato
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Conta *</label>
                <Select value={contaId} onValueChange={setContaId}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Inicial *</label>
                <DatePicker
                  date={dataInicio}
                  onDateChange={setDataInicio}
                  placeholder="Selecione a data inicial"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Final *</label>
                <DatePicker
                  date={dataFim}
                  onDateChange={setDataFim}
                  placeholder="Selecione a data final"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tipo</label>
                <Select value={tipo || 'ALL'} onValueChange={(value) => setTipo(value === 'ALL' ? '' : value)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Matriz</label>
                <Select value={matrizId || 'ALL'} onValueChange={(value) => setMatrizId(value === 'ALL' ? '' : value)}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerateExtrato} className={listingPrimaryButtonClassName}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Extrato
            </Button>
            {showExtrato && transacoes && transacoes.length > 0 && (
              <>
                <Button className={listingSecondaryButtonClassName} onClick={handleDownloadExtrato}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button className={listingSecondaryButtonClassName} onClick={handleDownloadPDF}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </ListingFilterCard>

      {showExtrato && contaId && dataInicio && dataFim && (
        <ListingTableCard>
          <CardHeader className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Calendar className="h-5 w-5 text-slate-500" />
                  Extrato Detalhado
                </CardTitle>
                {saldoData?.[0] && (
                  <div className="text-sm text-slate-500 space-y-1">
                    <p><strong>Conta:</strong> {saldoData[0].conta_nome} - {saldoData[0].conta_banco}</p>
                    <p><strong>Período:</strong> {dataInicio?.toLocaleDateString('pt-BR')} a {dataFim?.toLocaleDateString('pt-BR')}</p>
                    <p><strong>Saldo Anterior:</strong> {formatCurrency(saldoData[0].saldo_anterior || 0)}</p>
                  </div>
                )}
              </div>
              {saldoData?.[0] && (
                <FinanceStatusBadge
                  label={`Saldo Final: ${formatCurrency(saldoFinal)}`}
                  tone={saldoFinal < 0 ? 'danger' : 'success'}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {transacoesLoading || saldoLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Carregando extrato...</div>
            ) : transacoesError ? (
              <div className="py-10 text-center text-sm text-rose-600">Erro ao carregar extrato</div>
            ) : !transacoes || transacoes.length === 0 ? (
              <ListingEmptyState
                icon={Calendar}
                title="Nenhuma movimentação encontrada"
                description="Nenhuma movimentação foi encontrada para o período selecionado."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className={listingTableHeadClassName}>Data</TableHead>
                      <TableHead className={listingTableHeadClassName}>Tipo</TableHead>
                      <TableHead className={listingTableHeadClassName}>Fornecedor/Credor</TableHead>
                      <TableHead className={listingTableHeadClassName}>Nº Documento</TableHead>
                      <TableHead className={listingTableHeadClassName}>Projeto</TableHead>
                      <TableHead className={listingTableHeadClassName}>Matriz</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Valor</TableHead>
                      <TableHead className={`${listingTableHeadClassName} text-right`}>Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transacoesComSaldo.map((transacao: any, index: number) => (
                      <TableRow key={index} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>
                          {formatDateForDisplay(transacao.data)}
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>
                          <FinanceStatusBadge label={transacao.tipo} tone="neutral" />
                        </TableCell>
                        <TableCell className={listingTableCellClassName}>{transacao.fornecedor_creditor}</TableCell>
                        <TableCell className={listingTableCellClassName}>{transacao.numero_documento || '-'}</TableCell>
                        <TableCell className={listingTableCellClassName}>{transacao.projeto || '-'}</TableCell>
                        <TableCell className={listingTableCellClassName}>{transacao.matriz_nome || '-'}</TableCell>
                        <TableCell className={`${listingTableCellClassName} text-right`}>
                          <span className={transacao.valor < 0 ? 'font-medium text-rose-600' : 'font-medium text-emerald-600'}>
                            {formatCurrency(transacao.valor)}
                          </span>
                        </TableCell>
                        <TableCell className={`${listingTableCellClassName} text-right font-medium text-slate-900`}>
                          {formatCurrency(transacao.saldo_linha)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </ListingTableCard>
      )}
    </div>
  );
}
