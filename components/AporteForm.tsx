// Change note: Formulário para cadastro e edição de aportes com validação
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import createAporteAction from '@/actions/createAporte';
import updateAporteAction from '@/actions/updateAporte';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';

const aporteSchema = z.object({
  socioId: z.number({ required_error: 'Selecione um sócio' }),
  matrizId: z.number({ required_error: 'Selecione uma matriz' }),
  contaId: z.number({ required_error: 'Selecione uma conta' }),
  dataAporte: z.string().min(1, 'Data é obrigatória'),
  valor: z.number({ required_error: 'Valor é obrigatório' }).positive('Valor deve ser positivo'),
  observacoes: z.string().optional(),
});

type AporteFormData = z.infer<typeof aporteSchema>;

type Aporte = {
  id: number;
  socio_id: number;
  matriz_id: number;
  conta_id: number;
  data_aporte: string;
  valor: number;
  observacoes?: string;
};

type Socio = {
  id: number;
  nome: string;
};

type Matriz = {
  id: number;
  nome: string;
};

type Conta = {
  id: number;
  nome: string;
};

interface AporteFormProps {
  aporte?: Aporte | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AporteForm({ aporte, onSuccess, onCancel }: AporteFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load reference data
  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);

  const [createAporte] = useMutateAction(createAporteAction);
  const [updateAporte] = useMutateAction(updateAporteAction);

  const form = useForm<AporteFormData>({
    resolver: zodResolver(aporteSchema),
    defaultValues: {
      socioId: aporte?.socio_id || undefined,
      matrizId: aporte?.matriz_id || undefined,
      contaId: aporte?.conta_id || undefined,
      dataAporte: aporte?.data_aporte?.split('T')[0] || new Date().toISOString().split('T')[0],
      valor: aporte?.valor || undefined,
      observacoes: aporte?.observacoes || '',
    },
  });

  const onSubmit = async (data: AporteFormData) => {
    setIsSubmitting(true);
    try {
      if (aporte) {
        await updateAporte({
          id: aporte.id,
          ...data,
        });
        toast({
          title: 'Aporte atualizado',
          description: 'O aporte foi atualizado com sucesso.',
        });
      } else {
        await createAporte(data);
        toast({
          title: 'Aporte criado',
          description: 'O aporte foi cadastrado com sucesso e a movimentação foi registrada automaticamente.',
        });
      }
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar o aporte.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="socioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sócio *</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um sócio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {socios.map((socio: Socio) => (
                          <SelectItem key={socio.id} value={socio.id.toString()}>
                            {socio.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matrizId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matriz *</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma matriz" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {matrizes.map((matriz: Matriz) => (
                          <SelectItem key={matriz.id} value={matriz.id.toString()}>
                            {matriz.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Corrente *</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contas.map((conta: Conta) => (
                          <SelectItem key={conta.id} value={conta.id.toString()}>
                            {conta.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataAporte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Aporte *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre o aporte..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : aporte ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
