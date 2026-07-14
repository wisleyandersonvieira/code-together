'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, X, Calculator, Plus } from 'lucide-react';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadPrevisaoAportesWithRateioAction from '@/actions/loadPrevisaoAportesWithRateio';
import savePrevisaoAportesAction from '@/actions/savePrevisaoAportes';
import saveBatchPrevisaoAportesAction from '@/actions/saveBatchPrevisaoAportes';
import loadProjetoMembersAction from '@/actions/loadProjetoMembers';

interface PrevisaoItem {
  id?: number;
  membro_id: number;
  membro_nome: string;
  membro_tipo: string;
  data_previsao: string;
  valor_previsto: number;
  observacoes?: string;
  valor_rateado_total?: number;
  total_rateios?: number;
}

interface PrevisaoAportesEditModalProps {
  projetoId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function PrevisaoAportesEditModal({ 
  projetoId, 
  isOpen, 
  onClose, 
  onSaved 
}: PrevisaoAportesEditModalProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [savePrevisaoAportes, isSaving] = useMutateAction(savePrevisaoAportesAction);
  const [saveBatchPrevisaoAportes] = useMutateAction(saveBatchPrevisaoAportesAction);
  const [previsoes, loadingPrevisoes, , refreshPrevisoes] = useLoadAction(
    loadPrevisaoAportesWithRateioAction, 
    [], 
    { projetoId }
  );
  const [membros] = useLoadAction(loadProjetoMembersAction, [], { projetoId });
  const [editablePrevisoes, setEditablePrevisoes] = useState<PrevisaoItem[]>([]);
  const [newDate, setNewDate] = useState('');
  const [showNewDateRow, setShowNewDateRow] = useState(false);

  // Initialize editable previsoes when data loads
  useEffect(() => {
    if (previsoes && membros) {
      const mapped = previsoes.map((p: any) => {
        const membro = membros.find((m: any) => m.id === p.membro_id);
        return {
          id: p.id,
          membro_id: p.membro_id,
          membro_nome: membro?.nome || 'Unknown',
          membro_tipo: membro?.cliente_id ? 'cliente' : membro?.empresa_id ? 'empresa' : 'grupo',
          data_previsao: p.data_previsao,
          valor_previsto: p.valor_previsto,
          observacoes: p.observacoes,
          valor_rateado_total: p.valor_rateado_total || 0,
          total_rateios: p.total_rateios || 0,
        };
      });
      setEditablePrevisoes(mapped);
    }
  }, [previsoes, membros]);

  // Get unique dates from current previsoes
  const uniqueDates = [...new Set(editablePrevisoes.map(p => p.data_previsao))].sort();

  // Group previsoes by date
  const previsoesByDate = uniqueDates.reduce((acc, date) => {
    acc[date] = editablePrevisoes.filter(p => p.data_previsao === date);
    return acc;
  }, {} as Record<string, PrevisaoItem[]>);

  // Update value for a specific previsao
  const updateValue = (membroId: number, date: string, newValue: number) => {
    setEditablePrevisoes(prev => 
      prev.map(p => 
        p.membro_id === membroId && p.data_previsao === date
          ? { ...p, valor_previsto: newValue }
          : p
      )
    );
  };

  // Add new date column
  const addNewDateColumn = () => {
    if (!newDate) {
      toast({
        description: 'Digite uma data válida',
        variant: 'destructive',
      });
      return;
    }

    const dateExists = uniqueDates.includes(newDate);
    if (dateExists) {
      toast({
        description: 'Esta data já existe na previsão',
        variant: 'destructive',
      });
      return;
    }

    // Add new previsoes for all members on this date
    const newPrevisoes = membros.map((membro: any) => ({
      membro_id: membro.id,
      membro_nome: membro.nome,
      membro_tipo: membro.cliente_id ? 'cliente' : membro.empresa_id ? 'empresa' : 'grupo',
      data_previsao: newDate,
      valor_previsto: 0,
      observacoes: 'Nova data adicionada manualmente',
      valor_rateado_total: 0,
      total_rateios: 0,
    }));

    setEditablePrevisoes(prev => [...prev, ...newPrevisoes]);
    setNewDate('');
    setShowNewDateRow(false);
  };

  // Função auxiliar para delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Save all changes with throttling
  const handleSave = async () => {
    try {

      // Estratégia 1: Tentar batch processing para poucos registros
      if (editablePrevisoes.length <= 50) {
        try {
          const projetoIds = editablePrevisoes.map(() => projetoId).join(',');
          const membroIds = editablePrevisoes.map(p => p.membro_id).join(',');
          const datasPrevisao = editablePrevisoes.map(p => p.data_previsao).join(',');
          const valoresPrevisto = editablePrevisoes.map(p => p.valor_previsto).join(',');
          const observacoesList = editablePrevisoes.map(p => p.observacoes || 'Editado manualmente').join('|');

          await saveBatchPrevisaoAportes({
            projetoIds,
            membroIds,
            datasPrevisao,
            valoresPrevisto,
            observacoesList
          });

        } catch (batchError) {
          throw batchError; // Vai para processamento sequencial
        }
      } else {
        throw new Error('Muitos registros para batch');
      }

      // Se chegou aqui, batch funcionou
      toast({
        description: `Previsão de aportes atualizada com sucesso! ${editablePrevisoes.length} registros processados.`,
      });

      refreshPrevisoes();
      
      if (onSaved) {
        onSaved();
      }

    } catch (error) {
      
      try {
        // Estratégia 2: Processamento sequencial com delay
        const batchSize = 5;
        const delayMs = 200;
        let processedCount = 0;

        for (let i = 0; i < editablePrevisoes.length; i += batchSize) {
          const batch = editablePrevisoes.slice(i, i + batchSize);
          
          const batchPromises = batch.map(previsao => 
            savePrevisaoAportes({
              projetoId,
              membroId: previsao.membro_id,
              dataPrevisao: previsao.data_previsao,
              valorPrevisto: previsao.valor_previsto,
              observacoes: previsao.observacoes || 'Editado manualmente',
            })
          );
          
          await Promise.all(batchPromises);
          processedCount += batch.length;
          
          
          // Delay entre batches
          if (i + batchSize < editablePrevisoes.length) {
            await delay(delayMs);
          }
        }

        toast({
          description: `Previsão de aportes atualizada com sucesso! ${editablePrevisoes.length} registros processados.`,
        });

        refreshPrevisoes();
        
        if (onSaved) {
          onSaved();
        }

      } catch (sequentialError) {
        console.error('Erro ao salvar previsões:', sequentialError);
        toast({
          description: 'Erro ao salvar previsões. Tente novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  // Get total for a date
  const getDateTotal = (date: string) => {
    return previsoesByDate[date]?.reduce((sum, p) => sum + p.valor_previsto, 0) || 0;
  };

  // Get member total across all dates
  const getMemberTotal = (membroId: number) => {
    return editablePrevisoes
      .filter(p => p.membro_id === membroId)
      .reduce((sum, p) => sum + p.valor_previsto, 0);
  };

  if (!isOpen) return null;

  if (loadingPrevisoes || !membros) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carregando previsão de aportes...</DialogTitle>
          </DialogHeader>
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando dados...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Editar Previsão de Aportes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {editablePrevisoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma previsão encontrada para este projeto.</p>
              <p className="text-sm">Crie orçamentos com datas previstas para gerar a previsão inicial.</p>
            </div>
          ) : (
            <>
              {/* Action buttons */}
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewDateRow(true)}
                  disabled={showNewDateRow}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Nova Data
                </Button>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>

              {/* New date input row */}
              {showNewDateRow && (
                <div className="flex gap-2 items-end p-4 bg-blue-50 rounded-lg">
                  <div>
                    <Label>Nova Data</Label>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <Button size="sm" onClick={addNewDateColumn}>
                    Adicionar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setShowNewDateRow(false);
                      setNewDate('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}

              {/* Editable table */}
              <div className="overflow-x-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Membro</TableHead>
                      {uniqueDates.map((date) => (
                        <TableHead key={date} className="text-right min-w-[150px]">
                          {new Date(date).toLocaleDateString()}
                        </TableHead>
                      ))}
                      <TableHead className="text-right min-w-[150px] font-bold">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...new Set(editablePrevisoes.map(p => p.membro_id))].map(membroId => {
                      const membro = editablePrevisoes.find(p => p.membro_id === membroId);
                      if (!membro) return null;

                      return (
                        <TableRow key={membroId} className="hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <div className="font-medium">{membro.membro_nome}</div>
                              <Badge variant="outline" className="text-xs">
                                {membro.membro_tipo}
                              </Badge>
                            </div>
                          </TableCell>
                          {uniqueDates.map((date) => {
                            const previsao = editablePrevisoes.find(
                              p => p.membro_id === membroId && p.data_previsao === date
                            );
                            const hasRateios = (previsao?.total_rateios || 0) > 0;
                            
                            return (
                              <TableCell key={`${membroId}-${date}`} className="text-right">
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={previsao?.valor_previsto || 0}
                                    onChange={(e) => updateValue(membroId, date, parseFloat(e.target.value) || 0)}
                                    className={`text-right ${hasRateios ? 'bg-yellow-50 border-yellow-300' : ''}`}
                                    disabled={hasRateios}
                                    title={hasRateios ? 'Este valor tem rateios vinculados e não pode ser editado' : ''}
                                  />
                                  {hasRateios && (
                                    <div className="text-xs text-yellow-600">
                                      {formatCurrency(previsao?.valor_rateado_total || 0)} rateado
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-mono font-bold">
                            <Badge className="bg-blue-100 text-blue-800">
                              {formatCurrency(getMemberTotal(membroId))}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {/* Total row */}
                    <TableRow className="border-t-2 bg-muted/30">
                      <TableCell className="font-bold">TOTAL POR DATA</TableCell>
                      {uniqueDates.map((date) => (
                        <TableCell key={date} className="text-right font-mono font-bold">
                          <Badge className="bg-gray-100 text-gray-800">
                            {formatCurrency(getDateTotal(date))}
                          </Badge>
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono font-bold">
                        <Badge className="bg-blue-600 text-white">
                          {formatCurrency(editablePrevisoes.reduce((sum, p) => sum + p.valor_previsto, 0))}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Legend */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-2">Instruções:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Edite os valores diretamente na tabela</li>
                  <li>• Valores com fundo amarelo têm rateios vinculados e não podem ser editados</li>
                  <li>• Use "Adicionar Nova Data" para criar novas colunas de aporte</li>
                  <li>• Clique em "Salvar Alterações" para confirmar as modificações</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
