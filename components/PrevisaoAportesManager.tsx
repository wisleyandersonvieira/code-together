'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, AlertCircle, DollarSign } from 'lucide-react';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import savePrevisaoAportesAction from '@/actions/savePrevisaoAportes';
import saveBatchPrevisaoAportesAction from '@/actions/saveBatchPrevisaoAportes';
import loadProjetoMembersAction from '@/actions/loadProjetoMembers';
import loadPrevisaoAportesByProjetoAction from '@/actions/loadPrevisaoAportesByProjeto';

interface PrevisaoAportesManagerProps {
  projetoId: number;
  orcamentosByDate: Record<string, number>;
  onSaved?: () => void;
}

export function PrevisaoAportesManager({ 
  projetoId, 
  orcamentosByDate, 
  onSaved 
}: PrevisaoAportesManagerProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [savePrevisaoAportes, isSaving] = useMutateAction(savePrevisaoAportesAction);
  const [saveBatchPrevisaoAportes] = useMutateAction(saveBatchPrevisaoAportesAction);
  const [membros] = useLoadAction(loadProjetoMembersAction, [], { projetoId });
  const [previsoesSalvas, , , refreshPrevisoes] = useLoadAction(loadPrevisaoAportesByProjetoAction, [], { projetoId });
  const [saved, setSaved] = useState(false);

  // Check if there are already saved predictions
  useEffect(() => {
    if (previsoesSalvas && previsoesSalvas.length > 0) {
      setSaved(true);
    } else {
      setSaved(false);
    }
  }, [previsoesSalvas]);

  const dates = Object.keys(orcamentosByDate).sort();

  const getMemberContribution = (member: any, date: string) => {
    const totalForDate = orcamentosByDate[date] || 0;
    return totalForDate * (member.percentage / 100);
  };

  const getMemberTotal = (member: any) => {
    return dates.reduce((total, date) => {
      return total + getMemberContribution(member, date);
    }, 0);
  };

  const getDateTotal = (date: string) => {
    return membros.reduce((total, member) => {
      return total + getMemberContribution(member, date);
    }, 0);
  };

  // Função auxiliar para fazer delay entre requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSalvarPrevisao = async () => {
    try {
      setSaved(false);
      console.log('Iniciando salvamento da previsão de aportes...');

      // Coletar todos os dados para batch processing
      const previsoes = [];
      let totalRegistros = 0;

      for (const member of membros) {
        for (const date of dates) {
          const valor = getMemberContribution(member, date);
          
          if (valor > 0) {
            previsoes.push({
              projetoId,
              membroId: member.id,
              dataPrevisao: date,
              valorPrevisto: valor,
              observacoes: 'Previsão calculada automaticamente com base no orçamento'
            });
            totalRegistros++;
          }
        }
      }

      if (previsoes.length === 0) {
        toast({
          description: 'Nenhuma previsão para salvar (todos os valores são zero).',
          variant: 'destructive',
        });
        return;
      }

      console.log(`Total de registros a salvar: ${totalRegistros}`);

      // Estratégia 1: Tentar batch processing se não tiver muitos registros
      if (previsoes.length <= 50) {
        try {
          const projetoIds = previsoes.map(p => p.projetoId).join(',');
          const membroIds = previsoes.map(p => p.membroId).join(',');
          const datasPrevisao = previsoes.map(p => p.dataPrevisao).join(',');
          const valoresPrevisto = previsoes.map(p => p.valorPrevisto).join(',');
          const observacoesList = previsoes.map(p => p.observacoes).join('|');

          await saveBatchPrevisaoAportes({
            projetoIds,
            membroIds,
            datasPrevisao,
            valoresPrevisto,
            observacoesList
          });

          console.log('Batch processing completado com sucesso');
        } catch (batchError) {
          console.log('Batch processing falhou, usando abordagem sequencial:', batchError);
          throw batchError; // Vai para a estratégia 2
        }
      } else {
        throw new Error('Muitos registros para batch processing');
      }

      // Se chegou aqui, batch processing funcionou
      refreshPrevisoes();
      setSaved(true);
      toast({
        description: `Previsão de aportes salva com sucesso! ${totalRegistros} registros processados.`,
      });

      if (onSaved) {
        setTimeout(() => {
          console.log('Executando callback onSaved...');
          onSaved();
        }, 100);
      }

    } catch (error) {
      console.log('Tentando abordagem sequencial com throttling...');
      
      try {
        // Estratégia 2: Processamento sequencial com delay
        const previsoes = [];
        for (const member of membros) {
          for (const date of dates) {
            const valor = getMemberContribution(member, date);
            if (valor > 0) {
              previsoes.push({
                projetoId,
                membroId: member.id,
                dataPrevisao: date,
                valorPrevisto: valor,
                observacoes: 'Previsão calculada automaticamente com base no orçamento'
              });
            }
          }
        }

        let processedCount = 0;
        const batchSize = 5; // Processar 5 por vez
        const delayMs = 200; // Delay de 200ms entre batches

        for (let i = 0; i < previsoes.length; i += batchSize) {
          const batch = previsoes.slice(i, i + batchSize);
          
          // Processar o batch atual
          const batchPromises = batch.map(previsao => 
            savePrevisaoAportes(previsao)
          );
          
          await Promise.all(batchPromises);
          processedCount += batch.length;
          
          console.log(`Processados ${processedCount}/${previsoes.length} registros`);
          
          // Delay entre batches (exceto no último)
          if (i + batchSize < previsoes.length) {
            await delay(delayMs);
          }
        }

        console.log('Processamento sequencial completado com sucesso');
        refreshPrevisoes();
        setSaved(true);
        toast({
          description: `Previsão de aportes salva com sucesso! ${previsoes.length} registros processados.`,
        });

        if (onSaved) {
          setTimeout(() => {
            console.log('Executando callback onSaved...');
            onSaved();
          }, 100);
        }

      } catch (sequentialError) {
        console.error('Erro no processamento sequencial:', sequentialError);
        toast({
          description: `Erro ao salvar previsão de aportes: ${(sequentialError as any)?.message || 'Erro desconhecido'}`,
          variant: 'destructive',
        });
      }
    }
  };

  if (dates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Adicione orçamentos com datas previstas para calcular a previsão de aportes.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!membros || membros.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            Carregando membros do projeto...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Previsão de Aportes dos Membros
        </CardTitle>
        <Button
          onClick={handleSalvarPrevisao}
          disabled={isSaving}
          size="sm"
          variant={saved ? "outline" : "default"}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : saved ? 'Atualizar Previsão' : 'Salvar Previsão'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Membro</TableHead>
                <TableHead className="text-center">%</TableHead>
                {dates.map((date) => (
                  <TableHead key={date} className="text-right min-w-[120px]">
                    {new Date(date).toLocaleDateString()}
                  </TableHead>
                ))}
                <TableHead className="text-right min-w-[120px] font-bold">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((member: any) => (
                <TableRow key={member.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <div className="font-medium">{member.nome}</div>
                      <Badge variant="outline" className="text-xs">
                        {member.cliente_id ? 'cliente' : member.empresa_id ? 'empresa' : 'grupo'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {member.percentage}%
                    </Badge>
                  </TableCell>
                  {dates.map((date) => {
                    const valor = getMemberContribution(member, date);
                    return (
                      <TableCell key={date} className="text-right font-mono">
                        {valor > 0 ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {formatCurrency(valor)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-mono font-bold">
                    <Badge className="bg-blue-100 text-blue-800">
                      {formatCurrency(getMemberTotal(member))}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Total row */}
              <TableRow className="border-t-2 bg-muted/30">
                <TableCell className="font-bold">TOTAL POR DATA</TableCell>
                <TableCell></TableCell>
                {dates.map((date) => (
                  <TableCell key={date} className="text-right font-mono font-bold">
                    <Badge className="bg-gray-100 text-gray-800">
                      {formatCurrency(getDateTotal(date))}
                    </Badge>
                  </TableCell>
                ))}
                <TableCell className="text-right font-mono font-bold">
                  <Badge className="bg-blue-600 text-white">
                    {formatCurrency(dates.reduce((total, date) => total + getDateTotal(date), 0))}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {membros.length}
              </div>
              <div className="text-sm text-muted-foreground">Membros</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {dates.length}
              </div>
              <div className="text-sm text-muted-foreground">Datas de Aporte</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(dates.reduce((total, date) => total + getDateTotal(date), 0))}
              </div>
              <div className="text-sm text-muted-foregroand">Total Previsto</div>
            </CardContent>
          </Card>
        </div>

        {/* Status */}
        {saved && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <Save className="h-4 w-4" />
              <span className="font-medium">Previsão disponível no sistema!</span>
            </div>
            <div className="text-sm text-green-700 mt-1">
              Você pode fazer o rateio nos contas a receber ou clicar em "Atualizar Previsão" para recalcular os valores.
            </div>
          </div>
        )}
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-sm font-medium mb-2">Debug Info:</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Projeto ID: {projetoId}</div>
              <div>Membros: {membros?.length || 0}</div>
              <div>Datas: {dates.length}</div>
              <div>Status salvamento: {saved ? 'Salvo' : 'Não salvo'}</div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium mb-2">Como funciona:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Cada valor é calculado como: (Valor do Orçamento na Data) × (% do Membro)</li>
            <li>• Clique em "Salvar Previsão" para gravar os dados no banco</li>
            <li>• Após salvar, você poderá fazer o rateio no contas a receber</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
