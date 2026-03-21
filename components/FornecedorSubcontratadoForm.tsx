'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutateAction } from '@uibakery/data';

import createFornecedorSubcontratadoAction from '@/actions/createFornecedorSubcontratado';
import updateFornecedorSubcontratadoAction from '@/actions/updateFornecedorSubcontratado';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { financeDetailFieldClassName, financeDetailTextareaClassName } from '@/components/finance/detail-ui';

const fornecedorSchema = z.object({
  nome_razao_social: z.string().min(2, 'Informe o nome ou razão social.'),
  nome_fantasia: z.string().optional(),
  cpf_cnpj: z.string().min(3, 'Informe o CPF/CNPJ/EIN.'),
  telefone: z.string().optional(),
  email: z.string().email('Email inválido.').optional().or(z.literal('')),
  contato_responsavel: z.string().optional(),
  observacoes: z.string().optional(),
  status: z.enum(['ativo', 'inativo']),
});

export type FornecedorSubcontratadoFormValues = z.infer<typeof fornecedorSchema>;

interface FornecedorSubcontratadoFormProps {
  fornecedor?: Partial<FornecedorSubcontratadoFormValues> & { id?: number };
  onSuccess: () => void;
  onCancel: () => void;
}

export function FornecedorSubcontratadoForm({
  fornecedor,
  onSuccess,
  onCancel,
}: FornecedorSubcontratadoFormProps) {
  const { toast } = useToast();
  const [createFornecedor, isCreating] = useMutateAction(createFornecedorSubcontratadoAction);
  const [updateFornecedor, isUpdating] = useMutateAction(updateFornecedorSubcontratadoAction);
  const isEditing = !!fornecedor?.id;

  const form = useForm<FornecedorSubcontratadoFormValues>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: {
      nome_razao_social: fornecedor?.nome_razao_social || '',
      nome_fantasia: fornecedor?.nome_fantasia || '',
      cpf_cnpj: fornecedor?.cpf_cnpj || '',
      telefone: fornecedor?.telefone || '',
      email: fornecedor?.email || '',
      contato_responsavel: fornecedor?.contato_responsavel || '',
      observacoes: fornecedor?.observacoes || '',
      status: fornecedor?.status === 'inativo' ? 'inativo' : 'ativo',
    },
  });

  const onSubmit = async (values: FornecedorSubcontratadoFormValues) => {
    try {
      if (isEditing) {
        await updateFornecedor({
          id: fornecedor?.id,
          ...values,
        });
      } else {
        await createFornecedor(values);
      }

      toast({
        description: isEditing
          ? 'Fornecedor subcontratado atualizado com sucesso.'
          : 'Fornecedor subcontratado criado com sucesso.',
      });
      onSuccess();
    } catch {
      toast({
        description: 'Não foi possível salvar o fornecedor subcontratado.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0">
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="nome_razao_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Razão Social</FormLabel>
                    <FormControl>
                      <Input {...field} className={financeDetailFieldClassName} placeholder="Nome ou razão social" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome_fantasia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome fantasia</FormLabel>
                    <FormControl>
                      <Input {...field} className={financeDetailFieldClassName} placeholder="Opcional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ/EIN Number</FormLabel>
                    <FormControl>
                      <Input {...field} className={financeDetailFieldClassName} placeholder="Documento fiscal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={financeDetailFieldClassName}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} className={financeDetailFieldClassName} placeholder="Telefone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" className={financeDetailFieldClassName} placeholder="email@empresa.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contato_responsavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável / contato</FormLabel>
                    <FormControl>
                      <Input {...field} className={financeDetailFieldClassName} placeholder="Nome do contato" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className={financeDetailTextareaClassName}
                      placeholder="Observações gerais sobre o fornecedor subcontratado"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl bg-slate-900 hover:bg-slate-800" disabled={isCreating || isUpdating}>
                {isEditing ? 'Salvar alterações' : 'Cadastrar fornecedor'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
