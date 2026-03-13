'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftRight, Save, X, AlertTriangle } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase } from '@/utils/timezone';
import loadContasAction from '@/actions/loadContas';
import createTransferenciaAction from '@/actions/createTransferencia';
import updateTransferenciaAction from '@/actions/updateTransferencia';

interface TransferenciaFormData {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: string;
  data_transferencia: Date;
  observacoes: string;
}

interface TransferenciaFormProps {
  transferencia?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransferenciaForm({ transferencia, onSuccess, onCancel }: TransferenciaFormProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const isEditing = !!transferencia;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransferenciaFormData>({
    defaultValues: {
      conta_origem_id: transferencia?.conta_origem_id?.toString() || '',
      conta_destino_id: transferencia?.conta_destino_id?.toString() || '',
      valor: transferencia?.valor?.toString() || '',
      data_transferencia: transferencia?.data_transferencia ? new Date(transferencia.data_transferencia) : new Date(),
      observacoes: transferencia?.observacoes || '',
    },
  });

  const [contas, loadingContas] = useLoadAction(loadContasAction, []);
  const [createTransferencia] = useMutateAction(createTransferenciaAction);
  const [updateTransferencia] = useMutateAction(updateTransferenciaAction);

  const watchContaOrigem = watch('conta_origem_id');
  const watchContaDestino = watch('conta_destino_id');
  const watchValor = watch('valor');

  // Get available destination accounts (exclude selected origin)
  const contasDestino = contas?.filter((conta: any) => 
    conta.id.toString() !== watchContaOrigem
  ) || [];

  // Get available origin accounts (exclude selected destination)
  const contasOrigem = contas?.filter((conta: any) => 
    conta.id.toString() !== watchContaDestino
  ) || [];

  const onSubmit = async (data: TransferenciaFormData) => {
    try {
      const valorNumerico = parseFloat(data.valor);
      
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        toast({
          title: "Erro de validação",
          description: "O valor deve ser um número positivo válido.",
          variant: "destructive",
        });
        return;
      }

      if (data.conta_origem_id === data.conta_destino_id) {
        toast({
          title: "Erro de validação",
          description: "A conta de origem deve ser diferente da conta de destino.",
          variant: "destructive",
        });
        return;
      }

      const transferenciaData = {
        conta_origem_id: parseInt(data.conta_origem_id),
        conta_destino_id: parseInt(data.conta_destino_id),
        valor: valorNumerico,
        data_transferencia: formatDateForDatabase(data.data_transferencia),
        observacoes: data.observacoes || null,
      };

      if (isEditing) {
        await updateTransferencia({
          id: transferencia.id,
          ...transferenciaData,
        });
        toast({
          title: "Transferência atualizada",
          description: "Transferência foi atualizada com sucesso.",
        });
      } else {
        await createTransferencia(transferenciaData);
        toast({
          title: "Transferência criada",
          description: "Nova transferência foi registrada com sucesso.",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving transferencia:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a transferência. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (loadingContas) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando contas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Editar Transferência' : 'Nova Transferência'}
          </h2>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Transferência</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="conta_origem_id">Conta de Origem *</Label>
                <Select 
                  value={watchContaOrigem} 
                  onValueChange={(value) => setValue('conta_origem_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasOrigem?.map((conta: any) => (
                      <SelectItem key={conta.id} value={conta.id.toString()}>
                        {conta.banco} - {conta.nome} ({conta.numero})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.conta_origem_id && (
                  <p className="text-sm text-red-500">{errors.conta_origem_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="conta_destino_id">Conta de Destino *</Label>
                <Select 
                  value={watchContaDestino} 
                  onValueChange={(value) => setValue('conta_destino_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasDestino?.map((conta: any) => (
                      <SelectItem key={conta.id} value={conta.id.toString()}>
                        {conta.banco} - {conta.nome} ({conta.numero})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.conta_destino_id && (
                  <p className="text-sm text-red-500">{errors.conta_destino_id.message}</p>
                )}
              </div>
            </div>

            {watchContaOrigem && watchContaDestino && watchContaOrigem === watchContaDestino && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">
                    A conta de origem deve ser diferente da conta de destino.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor da Transferência *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  {...register('valor', {
                    required: 'Valor é obrigatório',
                    validate: (value) => {
                      const num = parseFloat(value);
                      if (isNaN(num) || num <= 0) {
                        return 'Valor deve ser maior que zero';
                      }
                      return true;
                    }
                  })}
                />
                {watchValor && !isNaN(parseFloat(watchValor)) && (
                  <p className="text-sm text-muted-foreground">
                    Valor formatado: {formatCurrency(parseFloat(watchValor))}
                  </p>
                )}
                {errors.valor && (
                  <p className="text-sm text-red-500">{errors.valor.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_transferencia">Data da Transferência *</Label>
                <DatePicker
                  date={watch('data_transferencia')}
                  onDateChange={(date) => setValue('data_transferencia', date || new Date())}
                  placeholder="Selecione a data"
                />
                {errors.data_transferencia && (
                  <p className="text-sm text-red-500">{errors.data_transferencia.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações sobre a transferência (opcional)"
                rows={3}
                {...register('observacoes')}
              />
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting || (watchContaOrigem && watchContaDestino && watchContaOrigem === watchContaDestino)}
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Transferência'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
