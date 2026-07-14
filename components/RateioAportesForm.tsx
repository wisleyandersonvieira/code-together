'use client';

import React, { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Check } from 'lucide-react';
import loadPrevisaoAportesRateioEntityAction from '@/actions/loadPrevisaoAportesRateioEntity';
import debugPrevisaoAportesAction from '@/actions/debugPrevisaoAportes';
import checkPrevisaoAportesExistsAction from '@/actions/checkPrevisaoAportesExists';
import saveRateioAportesAction from '@/actions/saveRateioAportes';
import loadRateioAportesAction from '@/actions/loadRateioAportes';
import loadTotalRateadoPorAporteAction from '@/actions/loadTotalRateadoPorAporte';

interface RateioAportesFormProps {
  projetoId: number;
  entityType: 'cliente' | 'empresa' | 'grupo';
  entityId: number;
  valorTotal: number;
  onRateioChange: (rateios: AporteRateio[]) => void;
  disabled?: boolean;
  contaReceberId?: number | null;
}

interface AporteRateio {
  aporte_id: number;
  membro_id: number;
  membro_nome: string;
  membro_tipo: 'cliente' | 'empresa' | 'grupo';
  data_previsao: string;
  valor_previsto: number;
  pode_ratear: boolean;
  valor_rateado: number;
}

export function RateioAportesForm({ 
  projetoId, 
  entityType, 
  entityId, 
  valorTotal, 
  onRateioChange, 
  disabled = false,
  contaReceberId = null
}: RateioAportesFormProps) {
  const [aportes, aportesLoading, aportesError] = useLoadAction(
    loadPrevisaoAportesRateioEntityAction, 
    [], 
    { projetoId, entityType, entityId }
  );
  
  const [debugData] = useLoadAction(
    debugPrevisaoAportesAction,
    [],
    { projetoId }
  );

  const [aportesCheck] = useLoadAction(
    checkPrevisaoAportesExistsAction,
    [],
    { projetoId }
  );

  // Load existing rateio data when editing
  const [existingRateios, , , refreshRateios] = useLoadAction(
    loadRateioAportesAction,
    [],
    { contaReceberId: contaReceberId || null }
  );

  // Load total allocated amounts per aporte across all contas a receber
  const [totaisRateados, , , refreshTotaisRateados] = useLoadAction(
    loadTotalRateadoPorAporteAction,
    [],
    { projetoId: projetoId || null }
  );
  
  const [rateios, setRateios] = useState<AporteRateio[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Debug apenas em desenvolvimento
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    }
  }, [projetoId, entityType, entityId, valorTotal, aportes, debugData, aportesCheck]);

  // Inicializar rateios quando os aportes carregarem
  useEffect(() => {
    if (aportes && aportes.length > 0) {
      const rateiosIniciais = aportes.map((aporte: any) => {
        // Check if there's existing rateio data for this aporte
        const existingRateio = existingRateios?.find((er: any) => er.aporte_id === aporte.aporte_id);
        
        return {
          aporte_id: aporte.aporte_id,
          membro_id: aporte.membro_id,
          membro_nome: aporte.membro_nome,
          membro_tipo: aporte.membro_tipo,
          data_previsao: aporte.data_previsao,
          valor_previsto: parseFloat(aporte.valor_previsto) || 0,
          pode_ratear: aporte.pode_ratear,
          valor_rateado: existingRateio ? parseFloat(existingRateio.valor_rateado) || 0 : 0,
        };
      });
      setRateios(rateiosIniciais);
      setHasUnsavedChanges(false);
    }
  }, [aportes, existingRateios]);

  // Notificar mudanças
  useEffect(() => {
    onRateioChange(rateios);
  }, [rateios, onRateioChange]);

  const updateValorRateado = (aporteId: number, valor: number) => {
    setRateios(prev => 
      prev.map(rateio => 
        rateio.aporte_id === aporteId 
          ? { ...rateio, valor_rateado: valor } 
          : rateio
      )
    );
    setHasUnsavedChanges(true);
  };

  const distribuirProporcionalmente = () => {
    const aportesPermitidos = rateios.filter(r => r.pode_ratear && r.valor_previsto > 0);
    const totalPrevisto = aportesPermitidos.reduce((sum, r) => sum + r.valor_previsto, 0);
    
    if (totalPrevisto > 0) {
      const novosRateios = rateios.map(rateio => {
        if (rateio.pode_ratear && rateio.valor_previsto > 0) {
          const proporcao = rateio.valor_previsto / totalPrevisto;
          return { ...rateio, valor_rateado: valorTotal * proporcao };
        }
        return { ...rateio, valor_rateado: 0 };
      });
      setRateios(novosRateios);
      setHasUnsavedChanges(true);
    }
  };

  const zerarRateio = () => {
    setRateios(prev => 
      prev.map(rateio => ({ ...rateio, valor_rateado: 0 }))
    );
    setHasUnsavedChanges(true);
  };



  const totalRateado = rateios.reduce((sum, r) => sum + r.valor_rateado, 0);
  const diferenca = Math.abs(valorTotal - totalRateado);
  const rateioValido = diferenca < 0.01;

  // Agrupar rateios por data prevista
  const rateiosPorData = rateios.reduce((grupos: Record<string, AporteRateio[]>, rateio) => {
    const data = rateio.data_previsao;
    if (!grupos[data]) {
      grupos[data] = [];
    }
    grupos[data].push(rateio);
    return grupos;
  }, {});

  const datasOrdenadas = Object.keys(rateiosPorData).sort();

  // Calcular saldo atualizado baseado na previsão de aporte menos total já alocado
  const calcularSaldoAtualizado = (aporteId: number, valorRateadoAtual: number): number => {
    // Find the total rateado info for this aporte
    const totalInfo = totaisRateados?.find((t: any) => t.aporte_id === aporteId);
    
    if (!totalInfo) {
      // If no total info, assume the full predicted value is available
      const rateio = rateios.find(r => r.aporte_id === aporteId);
      return (rateio?.valor_previsto || 0) - valorRateadoAtual;
    }
    
    // Calculate remaining balance: predicted value minus current total allocated (excluding this account's current allocation)
    const existingAllocation = existingRateios?.find((er: any) => er.aporte_id === aporteId);
    const existingValue = existingAllocation ? parseFloat(existingAllocation.valor_rateado) || 0 : 0;
    
    // Total currently allocated by other accounts (excluding this one)
    const totalByOthers = parseFloat(totalInfo.total_rateado) - existingValue;
    
    // Remaining = predicted - allocated by others - current allocation in this form
    return parseFloat(totalInfo.valor_previsto) - totalByOthers - valorRateadoAtual;
  };

  if (!entityId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Selecione um cliente, empresa ou grupo na aba "Dados Gerais" para visualizar o rateio de aportes.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!projetoId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Selecione um projeto para visualizar o rateio de aportes.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (aportesLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            Carregando previsão de aportes...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (aportesError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-red-600">
            <div>Erro ao carregar previsão de aportes</div>
            <div className="text-sm mt-2">{aportesError.toString()}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aportes || aportes.length === 0) {
    const membrosProjetoCount = debugData?.find(d => d.tabela === 'PROJETO_MEMBERS') ? 
      debugData.filter(d => d.tabela === 'PROJETO_MEMBERS').length : 0;
    const aportesTotalCount = aportesCheck?.[0]?.total_aportes || 0;
    
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Previsão de aportes não cadastrada</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>Este projeto possui <strong>{membrosProjetoCount} membros</strong>, mas não há previsão de aportes cadastrada.</div>
              <div>Para fazer o rateio, é necessário cadastrar a previsão de aportes na aba de projetos.</div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-2">Como cadastrar previsão de aportes:</div>
                <div className="text-left space-y-1">
                  <div>1. Vá para a aba "Projetos"</div>
                  <div>2. Selecione o projeto desejado</div>
                  <div>3. Cadastre a previsão de aportes para cada membro</div>
                  <div>4. Retorne ao contas a receber para fazer o rateio</div>
                </div>
              </div>
            </div>

            {debugData && debugData.length > 0 && (
              <details className="text-xs mt-4">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                  Mostrar informações técnicas
                </summary>
                <div className="mt-2 p-2 bg-gray-100 rounded text-left">
                  <div>Membros do projeto encontrados: {membrosProjetoCount}</div>
                  <div>Previsões de aportes cadastradas: {aportesTotalCount}</div>
                  <pre className="mt-2 text-xs">{JSON.stringify(debugData, null, 2)}</pre>
                </div>
              </details>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Rateio de Aportes</CardTitle>
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={distribuirProporcionalmente}
            disabled={disabled}
          >
            Distribuir Proporcionalmente
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={zerarRateio}
            disabled={disabled}
          >
            Zerar Rateio
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
          <div>
            <div className="text-sm font-medium">Valor Total</div>
            <div className="text-lg">R$ {valorTotal.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Total Rateado</div>
            <div className="text-lg">R$ {totalRateado.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm font-medium flex items-center gap-1">
              Status
              {rateioValido ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className={`text-lg ${rateioValido ? 'text-green-600' : 'text-red-600'}`}>
              {rateioValido ? 'Válido' : `Diferença: R$ ${diferenca.toFixed(2)}`}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {datasOrdenadas.map((data) => {
            const rateiosData = rateiosPorData[data];
            const totalDataPrevisto = rateiosData.reduce((sum, r) => sum + r.valor_previsto, 0);
            const totalDataRateado = rateiosData.reduce((sum, r) => sum + r.valor_rateado, 0);
            
            return (
              <Card key={data} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Data: {new Date(data).toLocaleDateString()}
                    </CardTitle>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Previsto: </span>
                        <span className="font-medium">R$ {totalDataPrevisto.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rateado: </span>
                        <span className="font-medium">R$ {totalDataRateado.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Membro</TableHead>
                        <TableHead className="text-right">Valor Previsto</TableHead>
                        <TableHead className="text-right w-32">Valor Rateado</TableHead>
                        <TableHead className="text-right">Saldo Atualizado</TableHead>
                        <TableHead className="text-center w-20">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rateiosData.map((rateio, index) => {
                        const saldoAtualizado = calcularSaldoAtualizado(rateio.aporte_id, rateio.valor_rateado);
                        
                        return (
                          <TableRow key={rateio.aporte_id}>
                            <TableCell className="font-medium">
                              {rateio.membro_nome}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {rateio.valor_previsto.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={rateio.valor_rateado}
                                onChange={(e) => updateValorRateado(rateio.aporte_id, parseFloat(e.target.value) || 0)}
                                disabled={disabled || !rateio.pode_ratear}
                                className={`text-right w-full ${rateio.pode_ratear ? '' : 'bg-muted'}`}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant={saldoAtualizado >= 0 ? "default" : "destructive"}
                                className="text-xs font-mono"
                              >
                                R$ {saldoAtualizado.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {rateio.pode_ratear ? (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  ✓
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  ✗
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-sm text-muted-foreground">
          <div className="space-y-1">
            <div>• <strong>✓:</strong> {entityType === 'cliente' ? 'Cliente' : entityType === 'empresa' ? 'Empresa' : 'Grupo'} pode ratear valores para este membro</div>
            <div>• <strong>✗:</strong> {entityType === 'cliente' ? 'Cliente' : entityType === 'empresa' ? 'Empresa' : 'Grupo'} não possui participação neste membro</div>
            <div>• <strong>Saldo Atualizado:</strong> Saldo restante da previsão de aporte após todas as alocações</div>
            <div>• Use "Distribuir Proporcionalmente" para ratear baseado nos valores previstos</div>
            {hasUnsavedChanges && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800">
                <strong>Informação:</strong> O rateio será salvo automaticamente junto com a conta a receber.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
