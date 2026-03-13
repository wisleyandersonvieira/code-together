'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutateAction } from '@uibakery/data';
import createFornecedorAction from '@/actions/createFornecedor';
import fixFornecedoresSequenceAction from '@/actions/fixFornecedoresSequence';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  einNumber: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FornecedorFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function FornecedorForm({ onSuccess, onCancel }: FornecedorFormProps) {
  const { toast } = useToast();
  const [createFornecedor, isCreating] = useMutateAction(createFornecedorAction);
  const [fixSequence] = useMutateAction(fixFornecedoresSequenceAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      contactName: '',
      contactPhone: '',
      einNumber: '',
    },
  });

  async function onSubmit(values: FormData) {
    try {
      await createFornecedor({
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        contactName: values.contactName || null,
        contactPhone: values.contactPhone || null,
        einNumber: values.einNumber || null,
      });

      toast({ description: 'Fornecedor criado com sucesso!' });
      form.reset();
      onSuccess();
    } catch (error: any) {
      if (error?.message?.includes('id must be unique')) {
        try {
          // Fix sequence and try again
          await fixSequence();
          await createFornecedor({
            name: values.name,
            address: values.address || null,
            phone: values.phone || null,
            email: values.email || null,
            contactName: values.contactName || null,
            contactPhone: values.contactPhone || null,
            einNumber: values.einNumber || null,
          });

          toast({ description: 'Fornecedor criado com sucesso!' });
          form.reset();
          onSuccess();
        } catch (retryError) {
          toast({
            description: 'Erro ao salvar fornecedor. Tente novamente.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          description: 'Erro ao salvar fornecedor. Tente novamente.',
          variant: 'destructive',
        });
      }
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-2xl">Cadastrar Fornecedor</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="einNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EIN Number</FormLabel>
                    <FormControl>
                      <Input placeholder="12-3456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contato@fornecedor.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone do Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Rua, número, bairro, cidade, estado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Salvando...' : 'Criar Fornecedor'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
