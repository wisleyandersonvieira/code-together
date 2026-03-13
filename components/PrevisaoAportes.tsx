'use client';

import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, DollarSign, Save, Calculator } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import loadPrevisaoAportesAction from '@/actions/loadPrevisaoAportes';
import loadPrevisaoAportesWithRateioAction from '@/actions/loadPrevisaoAportesWithRateio';
import savePrevisaoAportesAction from '@/actions/savePrevisaoAportes';
import deletePrevisaoAportesSemRateioAction from '@/actions/deletePrevisaoAportesSemRateio';

interface Member {
  id: number;
  percentage: number;
  membro_nome: string;
  membro_tipo: string;
  cliente_id?: number;
  empresa_id?: number;
  grupo_id?: number;
}

interface Orcamento {
  id?: number;
  description: string;
  predicted_date?: string;
  value: number;
}

interface PrevisaoAportesProps {
  projetoId: number;
  members: Member[];
  orcamentos: Orcamento[];
  onBack: () => void;
}

export function PrevisaoAportes({ projetoId, members, orcamentos, onBack }: PrevisaoAportesProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [previsoes, loadingPrevisoes, errorPrevisoes, refreshPrevisoes] = useLoadAction(
    loadPrevisaoAportesAction, 
    [], 
    { projetoId }
  );
  const [previsoesComRateio, loadingPrevisoesComRateio] = useLoadAction(
    loadPrevisaoAportesWithRateioAction,
    [],
    { projetoId }
  );
  const [savePrevisao] = useMutateAction(savePrevisaoAportesAction);
  const [deletePrevisoesSemRateio] = useMutateAction(deletePrevisaoAportesSemRateioAction);
  const [saving, setSaving] = useState(false);

  // Get unique dates from orcamentos
  const dates = [...new Set(
    orcamentos
      .filter(orc => orc.predicted_date)
      .map(orc => orc.predicted_date!)
  )].sort();

  // Debug log para investigar o problema
  React.useEffect(() => {
    console.log('PrevisaoAportes - Debug Info:');
    console.log('Orçamentos recebidos:', orcamentos);
    console.log('Orçamentos com data:', orcamentos.filter(orc => orc.predicted_date));
    console.log('Datas extraídas:', dates);
    console.log('Botão habilitado:', !saving && dates.length > 0);
  }, [orcamentos, dates, saving]);

  // Group orcamentos by date
  const orcamentosByDate = dates.reduce((acc, date) => {
    acc[date] = orcamentos
      .filter(orc => orc.predicted_date === date)
      .reduce((sum, orc) => sum + orc.value, 0);
    return acc;
  }, {} as Record<string, number>);

  // Calculate member contribution for each date
  const getMemberContribution = (member: Member, date: string) => {
    const totalForDate = orcamentosByDate[date] || 0;
    return totalForDate * (member.percentage / 100);
  };

  // Get total contribution for a member across all dates
  const getMemberTotal = (member: Member) => {
    return dates.reduce((total, date) => {
      return total + getMemberContribution(member, date);
    }, 0);
  };

  // Get total for a specific date across all members
  const getDateTotal = (date: string) => {
    return members.reduce((total, member) => {
      return total + getMemberContribution(member, date);
    }, 0);
  };

  // Generate previsao data automatically
  const generatePrevisoes = async () => {
    try {
      setSaving(true);
      
      console.log('Iniciando geração de previsões...');
      console.log('Previsões com rateio existentes:', previsoesComRateio);
      
      // First, delete only previsoes that don't have rateios linked
      await deletePrevisoesSemRateio({ projetoId });
      console.log('Previsões sem rateio deletadas');

      let preservedCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      // Create or update previsoes
      for (const member of members) {
        for (const date of dates) {
          const valorPrevisto = getMemberContribution(member, date);
          if (valorPrevisto > 0) {
            // Check if this previsao already exists with rateio
            const existingPrevisao = previsoesComRateio?.find(p => 
              p.membro_id === member.id && p.data_previsao === date
            );

            try {
              // Always use savePrevisao (with UPSERT) - it will handle both insert and update
              const observacoes = existingPrevisao && existingPrevisao.total_rateios > 0 
                ? `Aporte atualizado automaticamente (${member.percentage}% de ${formatCurrency(orcamentosByDate[date])}) - Preservando rateios existentes`
                : `Aporte calculado automaticamente (${member.percentage}% de ${formatCurrency(orcamentosByDate[date])})`;

              const result = await savePrevisao({
                projetoId,
                membroId: member.id,
                dataPrevisao: date,
                valorPrevisto,
                observacoes
              });

              if (existingPrevisao && existingPrevisao.total_rateios > 0) {
                updatedCount++;
                preservedCount++;
                console.log(`Atualizada previsão existente com rateios: membro ${member.id}, data ${date}, valor ${valorPrevisto}`, result);
              } else {
                createdCount++;
                console.log(`Criada nova previsão: membro ${member.id}, data ${date}, valor ${valorPrevisto}`, result);
              }
            } catch (itemError) {
              console.error(`Erro ao salvar previsão para membro ${member.id}, data ${date}:`, itemError);
              // Continue with next item instead of failing completely
            }
          }
        }
      }

      const totalWithRateios = previsoesComRateio?.filter(p => p.total_rateios > 0).length || 0;

      toast({
        title: "Previsão atualizada com sucesso",
        description: `${createdCount} novas previsões criadas, ${updatedCount} atualizadas. ${totalWithRateios} previsões com rateios preservadas.`,
      });

      console.log(`Resumo: ${createdCount} criadas, ${updatedCount} atualizadas, ${totalWithRateios} com rateios preservadas`);
      
      refreshPrevisoes();
    } catch (error) {
      console.error('Error generating previsoes:', error);
      toast({
        title: "Erro",
        description: `Não foi possível gerar a previsão de aportes. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingPrevisoes) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando previsões...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Previsão de Aportes</h2>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Voltar ao Projeto
          </Button>
          <Button onClick={generatePrevisoes} disabled={saving || dates.length === 0}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Gerando...' : 'Gerar Previsão'}
          </Button>
        </div>
      </div>

      {dates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma data de previsão</h3>
            <p className="text-muted-foreground">
              Adicione orçamentos com datas previstas para gerar a previsão de aportes.
            </p>
            
            {/* Debug info */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-left">
              <div className="text-sm font-medium mb-2">Debug Info:</div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Total orçamentos: {orcamentos.length}</div>
                <div>Orçamentos com data: {orcamentos.filter(orc => orc.predicted_date).length}</div>
                <div>Membros: {members.length}</div>
                <div>Projeto ID: {projetoId}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Rateio de Aportes por Membro e Data
            </CardTitle>
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
                  {members.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{member.membro_nome}</div>
                          <Badge variant="outline" className="text-xs">
                            {member.membro_tipo}
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
                    {members.length}
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
                  <div className="text-sm text-muted-foreground">Total Previsto</div>
                </CardContent>
              </Card>
            </div>

            {/* Rateios Status */}
            {previsoesComRateio && previsoesComRateio.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium mb-2 text-green-800">Status dos Rateios Existentes:</h4>
                <div className="text-sm text-green-700 space-y-1">
                  {previsoesComRateio
                    .filter(p => p.total_rateios > 0)
                    .map((previsao, index) => {
                      const member = members.find(m => m.id === previsao.membro_id);
                      return (
                        <div key={index} className="flex justify-between items-center">
                          <span>
                            {member?.membro_nome} - {new Date(previsao.data_previsao).toLocaleDateString()}
                          </span>
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            {formatCurrency(previsao.valor_rateado_total)} rateado
                          </Badge>
                        </div>
                      );
                    })}
                </div>
                <p className="text-xs text-green-600 mt-2">
                  ✓ Estas previsões têm rateios vinculados e serão preservadas ao gerar nova previsão.
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-2">Como funciona o cálculo:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Cada valor é calculado como: (Valor do Orçamento na Data) × (% do Membro)</li>
                <li>• A coluna "Total" mostra a soma de todos os aportes previstos para cada membro</li>
                <li>• A linha "TOTAL POR DATA" mostra quanto será necessário aportar em cada data</li>
                <li>• Previsões com rateios vinculados são preservadas e apenas atualizadas</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
