// Single-line change note: Create retirada form for managing financial withdrawals

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import createRetiradaAction from '@/actions/createRetirada';
import updateRetiradaAction from '@/actions/updateRetirada';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import { useCurrency } from '@/hooks/use-currency';
import { DatePicker } from '@/components/ui/date-picker';

interface RetiradaFormProps {
  retirada?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RetiradaForm({ retirada, onSuccess, onCancel }: RetiradaFormProps) {
  const { toast } = useToast();
  const { formatCurrency, parseCurrencyInput, formatCurrencyInput } = useCurrency();

  const [formData, setFormData] = useState({
    socio_id: retirada?.socio_id || '',
    matriz_id: retirada?.matriz_id || '',
    conta_id: retirada?.conta_id || '',
    data_retirada: retirada?.data_retirada || '',
    valor: retirada?.valor || '',
    observacoes: retirada?.observacoes || '',
  });

  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);

  const [createRetirada, isCreating] = useMutateAction(createRetiradaAction);
  const [updateRetirada, isUpdating] = useMutateAction(updateRetiradaAction);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started', formData);

    if (!formData.socio_id || !formData.matriz_id || !formData.conta_id || !formData.data_retirada || !formData.valor) {
      console.log('Validation failed - missing required fields');
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const valorNumerico = parseCurrencyInput(formData.valor.toString());
    if (!valorNumerico || valorNumerico <= 0) {
      toast({
        title: "Erro",
        description: "O valor deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    try {
      const params = {
        ...(retirada && { id: retirada.id }),
        socioId: parseInt(formData.socio_id),
        matrizId: parseInt(formData.matriz_id),
        contaId: parseInt(formData.conta_id),
        dataRetirada: formData.data_retirada,
        valor: valorNumerico,
        observacoes: formData.observacoes || null,
      };

      console.log('Submitting with params:', params);

      if (retirada) {
        await updateRetirada(params);
        toast({
          title: "Sucesso",
          description: "Retirada atualizada com sucesso!",
        });
      } else {
        await createRetirada(params);
        toast({
          title: "Sucesso",
          description: "Retirada criada com sucesso!",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar retirada:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar retirada. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow only numbers, comma, and dot
    const cleanValue = inputValue.replace(/[^0-9.,]/g, '');
    setFormData({ ...formData, valor: cleanValue });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {retirada ? 'Editar Retirada' : 'Nova Retirada'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="socio_id">Sócio *</Label>
              <Select
                value={formData.socio_id}
                onValueChange={(value) => setFormData({ ...formData, socio_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um sócio" />
                </SelectTrigger>
                <SelectContent>
                  {socios.map((socio) => (
                    <SelectItem key={socio.id} value={socio.id.toString()}>
                      {socio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="matriz_id">Matriz *</Label>
              <Select
                value={formData.matriz_id}
                onValueChange={(value) => setFormData({ ...formData, matriz_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma matriz" />
                </SelectTrigger>
                <SelectContent>
                  {matrizes.map((matriz) => (
                    <SelectItem key={matriz.id} value={matriz.id.toString()}>
                      {matriz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="conta_id">Conta *</Label>
              <Select
                value={formData.conta_id}
                onValueChange={(value) => setFormData({ ...formData, conta_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.nome} - {conta.banco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_retirada">Data da Retirada *</Label>
              <DatePicker
                date={formData.data_retirada ? new Date(formData.data_retirada + 'T12:00:00') : undefined}
                onDateChange={(date) => {
                  if (date) {
                    // Format date as YYYY-MM-DD to avoid timezone issues
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    setFormData({ ...formData, data_retirada: `${year}-${month}-${day}` });
                  } else {
                    setFormData({ ...formData, data_retirada: '' });
                  }
                }}
                placeholder="Selecione a data"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              value={formData.valor}
              onChange={handleValorChange}
              placeholder="R$ 0,00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações opcionais..."
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isCreating || isUpdating}
            >
              {isCreating || isUpdating ? 'Salvando...' : (retirada ? 'Atualizar' : 'Criar')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
