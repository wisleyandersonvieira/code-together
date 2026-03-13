'use client';

import React, { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, DollarSign, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadParametrosAction from '@/actions/loadParametros';
import updateParametroAction from '@/actions/updateParametro';

export function ParametrosList() {
  const { toast } = useToast();
  const [parametros, loading, error, refresh] = useLoadAction(loadParametrosAction, []);
  const [updateParametro, isSaving] = useMutateAction(updateParametroAction);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const moedaOptions = [
    { value: 'BRL', label: 'R$ Real Brasileiro', icon: '🇧🇷' },
    { value: 'USD', label: '$ Dólar Americano', icon: '🇺🇸' }
  ];

  const getParametroValue = (chave: string) => {
    if (editingValues[chave] !== undefined) {
      return editingValues[chave];
    }
    const param = parametros?.find((p: any) => p.chave === chave);
    return param?.valor || '';
  };

  const hasChanges = (chave: string) => {
    const param = parametros?.find((p: any) => p.chave === chave);
    return editingValues[chave] !== undefined && editingValues[chave] !== param?.valor;
  };

  const handleSave = async (chave: string) => {
    try {
      await updateParametro({
        chave,
        valor: editingValues[chave]
      });

      toast({
        title: "Parâmetro atualizado",
        description: `${chave} foi atualizado com sucesso`,
      });

      // Clear editing state and refresh
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[chave];
        return newValues;
      });
      
      refresh();
    } catch (error) {
      console.error('Error updating parameter:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o parâmetro",
        variant: "destructive",
      });
    }
  };

  const handleCancel = (chave: string) => {
    setEditingValues(prev => {
      const newValues = { ...prev };
      delete newValues[chave];
      return newValues;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Settings className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando parâmetros...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-red-600">
            <p>Erro ao carregar parâmetros: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentMoeda = getParametroValue('MOEDA');
  const currentMoedaOption = moedaOptions.find(opt => opt.value === currentMoeda);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Parâmetros do Sistema</h2>
        </div>
        <Badge variant="outline">Configurações Gerais</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configurações de Moeda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Moeda do Sistema
              </label>
              <Select
                value={getParametroValue('MOEDA')}
                onValueChange={(value) => setEditingValues(prev => ({ ...prev, MOEDA: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda">
                    {currentMoedaOption && (
                      <div className="flex items-center gap-2">
                        <span>{currentMoedaOption.icon}</span>
                        <span>{currentMoedaOption.label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {moedaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Moeda utilizada para exibição de valores em todo o sistema
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Status Atual
              </label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                {hasChanges('MOEDA') ? (
                  <>
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium text-orange-700">
                      Alteração Pendente
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      Configurado
                    </span>
                  </>
                )}
              </div>
              {hasChanges('MOEDA') && (
                <p className="text-xs text-orange-600">
                  Clique em "Salvar" para aplicar as alterações
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Ações
              </label>
              <div className="flex gap-2">
                {hasChanges('MOEDA') ? (
                  <>
                    <Button
                      onClick={() => handleSave('MOEDA')}
                      disabled={isSaving}
                      size="sm"
                      className="flex-1"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      onClick={() => handleCancel('MOEDA')}
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center p-2 border rounded-lg bg-green-50 border-green-200 flex-1">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <span className="text-sm text-green-700">Salvo</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Como funciona?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• A moeda selecionada será aplicada em todos os valores do sistema</li>
              <li>• Contas a Pagar, Contas a Receber e Projetos usarão esta configuração</li>
              <li>• A formatação dos números seguirá o padrão da moeda escolhida</li>
              <li>• As alterações são aplicadas imediatamente após salvar</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
