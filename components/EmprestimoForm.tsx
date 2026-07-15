// Change note: Formulário para cadastro e edição de empréstimos e pagamentos de empréstimo
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
import createEmprestimoAction from '@/actions/createEmprestimo';
import updateEmprestimoAction from '@/actions/updateEmprestimo';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';

const emprestimoSchema = z.object({
  socioId: z.number({ required_error: 'Selecione um sócio' }),
  matrizId: z.number({ required_error: 'Selecione uma matriz' }),
  contaId: z.number({ required_error: 'Selecione uma conta' }),
  dataEmprestimo: z.string().min(1, 'Data é obrigatória'),
  valor: z.number({ required_error: 'Valor é obrigatório' }).positive('Valor deve ser positivo'),
  observacoes: z.string().optional(),
});

type EmprestimoFormData = z.infer<typeof emprestimoSchema>;

export type EmprestimoTipo = 'EMPRESTIMO' | 'PAGAMENTO';

type Emprestimo = {
  id: number;
  tipo: EmprestimoTipo;
  socio_id: number;
  matriz_id: number;
  conta_id: number;
  data_emprestimo: string;
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

interface EmprestimoFormProps {
  /** Define o tipo gravado no registro e o título do modal */
  tipo: EmprestimoTipo;
  emprestimo?: Emprestimo | null;
  /**
   * Chamado após salvar com sucesso. Quando `keepOpen` é true (cadastro de um
   * novo registro), o modal deve permanecer aberto para agilizar novos lançamentos.
   */
  onSuccess: (options?: { keepOpen?: boolean }) => void;
  onCancel: () => void;
}

export function EmprestimoForm({ tipo, emprestimo, onSuccess, onCancel }: EmprestimoFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPagamento = tipo === 'PAGAMENTO';
  const entidade = isPagamento ? 'pagamento de empréstimo' : 'empréstimo';

  // Load reference data
  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);

  const [createEmprestimo] = useMutateAction(createEmprestimoAction);
  const [updateEmprestimo] = useMutateAction(updateEmprestimoAction);

  const form = useForm<EmprestimoFormData>({
    resolver: zodResolver(emprestimoSchema),
    defaultValues: {
      socioId: emprestimo?.socio_id || undefined,
      matrizId: emprestimo?.matriz_id || undefined,
      contaId: emprestimo?.conta_id || undefined,
      dataEmprestimo: emprestimo?.data_emprestimo?.split('T')[0] || new Date().toISOString().split('T')[0],
      valor: emprestimo?.valor || undefined,
      observacoes: emprestimo?.observacoes || '',
    },
  });

  const onSubmit = async (data: EmprestimoFormData) => {
    setIsSubmitting(true);
    try {
      if (emprestimo) {
        await updateEmprestimo({
          id: emprestimo.id,
          tipo,
          ...data,
        });
        toast({
          title: 'Registro atualizado',
          description: `O ${entidade} foi atualizado com sucesso.`,
        });
        onSuccess();
      } else {
        await createEmprestimo({ tipo, ...data });
        toast({
          title: 'Registro criado',
          description: isPagamento
            ? 'O pagamento de empréstimo foi cadastrado e a entrada foi registrada na conta.'
            : 'O empréstimo foi cadastrado e a saída foi registrada na conta.',
        });
        // Mantém sócio, matriz e conta preenchidos e limpa apenas data, valor e
        // observações, para facilitar o cadastro de vários lançamentos seguidos.
        form.reset({
          ...form.getValues(),
          dataEmprestimo: new Date().toISOString().split('T')[0],
          valor: undefined,
          observacoes: '',
        });
        form.setFocus('valor');
        onSuccess({ keepOpen: true });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || `Não foi possível salvar o ${entidade}.`,
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
                name="dataEmprestimo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isPagamento ? 'Data do Pagamento *' : 'Data do Empréstimo *'}</FormLabel>
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
                      placeholder={`Observações sobre o ${entidade}...`}
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
                {isSubmitting ? 'Salvando...' : emprestimo ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
