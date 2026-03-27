'use client';

import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard } from 'lucide-react';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { DialogFooter } from '@/components/ui/dialog';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase } from '@/utils/timezone';
import loadTitulosByContaPagarAction from '@/actions/loadTitulosByContaPagar';
import payTituloPagarAction from '@/actions/payTituloPagar';

interface PaymentModalContentProps {
  conta: any;
  contas: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModalContent({ conta, contas, onClose, onSuccess }: PaymentModalContentProps) {
  const { formatCurrency } = useCurrency();
  const [titulos, loading] = useLoadAction(loadTitulosByContaPagarAction, [], { contaPagarId: conta.id });
  const [payTituloPagar] = useMutateAction(payTituloPagarAction);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    conta_id: '',
    data_pagamento: new Date(),
    observacoes: '',
  });

  const handlePayment = async () => {
    if (!paymentForm.conta_id || selectedTitulos.length === 0) return;

    try {
      for (const tituloId of selectedTitulos) {
        const titulo = titulos.find((t: any) => t.id === tituloId);
        if (titulo && titulo.status !== 'PAGO') {
          await payTituloPagar({
            id: titulo.id,
            valor_pago: titulo.valor,
            data_pagamento: formatDateForDatabase(paymentForm.data_pagamento),
            conta_id: parseInt(paymentForm.conta_id),
            observacoes_pagamento: paymentForm.observacoes,
          });
        }
      }
      onSuccess();
    } catch (error) {
      console.error('Error paying títulos:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Carregando títulos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Conta para Pagamento</label>
          <Select value={paymentForm.conta_id} onValueChange={(value) => setPaymentForm({...paymentForm, conta_id: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas?.map((conta: any) => (
                <SelectItem key={conta.id} value={conta.id.toString()}>
                  {conta.banco} - {conta.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Data do Pagamento</label>
          <DatePickerWithYearSelector
            date={paymentForm.data_pagamento}
            onDateChange={(date) => setPaymentForm({...paymentForm, data_pagamento: date || new Date()})}
            placeholder="Selecione a data"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Observações</label>
        <Input
          placeholder="Observações do pagamento"
          value={paymentForm.observacoes}
          onChange={(e) => setPaymentForm({...paymentForm, observacoes: e.target.value})}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Títulos para Pagamento</label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Pagar</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {titulos?.map((titulo: any) => (
              <TableRow key={titulo.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    disabled={titulo.status === 'PAGO'}
                    checked={selectedTitulos.includes(titulo.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTitulos([...selectedTitulos, titulo.id]);
                      } else {
                        setSelectedTitulos(selectedTitulos.filter(id => id !== titulo.id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>{titulo.parcela}/{titulo.total_parcelas}</TableCell>
                <TableCell>{new Date(titulo.data_vencimento).toLocaleDateString()}</TableCell>
                <TableCell>{formatCurrency(parseFloat(titulo.valor))}</TableCell>
                <TableCell>
                  <Badge variant={titulo.status === 'PAGO' ? 'default' : 'destructive'}>
                    {titulo.status === 'PAGO' ? 'Pago' : 'Pendente'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handlePayment} disabled={!paymentForm.conta_id || selectedTitulos.length === 0}>
          <CreditCard className="mr-2 h-4 w-4" />
          Efetuar Pagamento
        </Button>
      </DialogFooter>
    </div>
  );
}
