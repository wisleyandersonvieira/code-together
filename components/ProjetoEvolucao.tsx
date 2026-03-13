'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import loadProjetoEvolucaoOrcamentoAction from '@/actions/loadProjetoEvolucaoOrcamento';
import loadProjetoEvolucaoAportesAction from '@/actions/loadProjetoEvolucaoAportes';

interface ProjetoEvolucaoProps {
  projetoId: number;
  projetoName: string;
  projetoStatus?: string;
}

export function ProjetoEvolucao({ projetoId, projetoName, projetoStatus }: ProjetoEvolucaoProps) {
  const [orcamentos, orcamentosLoading, orcamentosError] = useLoadAction(
    loadProjetoEvolucaoOrcamentoAction, 
    [], 
    { projetoId }
  );
  
  const [aportes, aportesLoading, aportesError] = useLoadAction(
    loadProjetoEvolucaoAportesAction, 
    [], 
    { projetoId }
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONCLUÍDO':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'EM ANDAMENTO':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'CONCLUÍDO':
        return 'default';
      case 'EM ANDAMENTO':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getProgressPercentage = (realizado: number, previsto: number) => {
    if (previsto === 0) return 0;
    return Math.min((realizado / previsto) * 100, 100);
  };

  // Calculate totals
  const totalOrcado = orcamentos?.reduce((sum: number, item: any) => sum + parseFloat(item.valor_orcado || 0), 0) || 0;
  const totalRealizadoOrcamento = orcamentos?.reduce((sum: number, item: any) => sum + parseFloat(item.valor_realizado || 0), 0) || 0;
  const saldoRestanteOrcamento = totalOrcado - totalRealizadoOrcamento;

  const totalPrevisto = aportes?.reduce((sum: number, item: any) => sum + parseFloat(item.valor_previsto || 0), 0) || 0;
  const totalRealizadoAportes = aportes?.reduce((sum: number, item: any) => sum + parseFloat(item.valor_realizado || 0), 0) || 0;
  const saldoRestanteAportes = totalPrevisto - totalRealizadoAportes;

  if (orcamentosLoading || aportesLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Carregando evolução do projeto...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orcamentosError || aportesError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-500">Erro ao carregar dados da evolução</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <div className="text-sm font-medium">Total Orçado</div>
            </div>
            <div className="text-xl font-bold text-blue-600">
              $ {totalOrcado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-sm font-medium">Realizado (Orçamento)</div>
            </div>
            <div className="text-xl font-bold text-green-600">
              $ {totalRealizadoOrcamento.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalOrcado > 0 ? `${((totalRealizadoOrcamento / totalOrcado) * 100).toFixed(1)}%` : '0%'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium">Previsto (Aportes)</div>
            </div>
            <div className="text-xl font-bold text-purple-600">
              $ {totalPrevisto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-orange-600" />
              <div className="text-sm font-medium">Recebido (Aportes)</div>
            </div>
            <div className="text-xl font-bold text-orange-600">
              $ {totalRealizadoAportes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalPrevisto > 0 ? `${((totalRealizadoAportes / totalPrevisto) * 100).toFixed(1)}%` : '0%'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Evolution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução do Orçamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orcamentos && orcamentos.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data Prevista</TableHead>
                      <TableHead className="text-right">Valor Orçado</TableHead>
                      <TableHead className="text-right">Valor Realizado</TableHead>
                      <TableHead className="text-right">Saldo Restante</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orcamentos.map((item: any) => {
                      const valorOrcado = parseFloat(item.valor_orcado) || 0;
                      const valorRealizado = parseFloat(item.valor_realizado) || 0;
                      const saldoRestante = parseFloat(item.saldo_restante) || 0;
                      const progress = getProgressPercentage(valorRealizado, valorOrcado);
                      
                      return (
                        <TableRow key={item.orcamento_id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>
                            {item.predicted_date 
                              ? new Date(item.predicted_date).toLocaleDateString()
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            $ {valorOrcado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            $ {valorRealizado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={saldoRestante < 0 ? 'text-red-600' : 'text-green-600'}>
                              $ {saldoRestante.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <div className="text-xs text-muted-foreground">
                                {progress.toFixed(1)}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(item.status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(item.status)}
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-end p-4 border-t bg-muted/50">
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    Total: $ {totalOrcado.toLocaleString('en-US', { minimumFractionDigits: 2 })} 
                    <span className="text-sm text-muted-foreground ml-2">
                      (Realizado: $ {totalRealizadoOrcamento.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Saldo restante: $ {saldoRestanteOrcamento.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum orçamento cadastrado para este projeto.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investment Evolution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Evolução dos Aportes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aportes && aportes.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membro</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data Previsão</TableHead>
                      <TableHead className="text-right">Valor Previsto</TableHead>
                      <TableHead className="text-right">Valor Realizado</TableHead>
                      <TableHead className="text-right">Saldo Restante</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aportes.map((item: any) => {
                      const valorPrevisto = parseFloat(item.valor_previsto) || 0;
                      const valorRealizado = parseFloat(item.valor_realizado) || 0;
                      const saldoRestante = parseFloat(item.saldo_restante) || 0;
                      const progress = getProgressPercentage(valorRealizado, valorPrevisto);
                      
                      return (
                        <TableRow key={item.aporte_id}>
                          <TableCell className="font-medium">{item.membro_nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.membro_tipo}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(item.data_previsao).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            $ {valorPrevisto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            $ {valorRealizado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={saldoRestante < 0 ? 'text-red-600' : 'text-green-600'}>
                              $ {saldoRestante.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <div className="text-xs text-muted-foreground">
                                {progress.toFixed(1)}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(item.status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(item.status)}
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end p-4 border-t bg-muted/50">
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    Total: $ {totalPrevisto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <span className="text-sm text-muted-foreground ml-2">
                      (Recebido: $ {totalRealizadoAportes.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Saldo restante: $ {saldoRestanteAportes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma previsão de aportes cadastrada para este projeto.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
