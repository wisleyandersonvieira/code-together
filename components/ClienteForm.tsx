'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { YearMonthDayPicker } from '@/components/ui/year-month-day-picker';
import { FileManager } from './FileManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Link } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ClienteVinculos } from './ClienteVinculos';
import { useMutateAction } from '@uibakery/data';
import createClienteAction from '@/actions/createCliente';
import updateClienteAction from '@/actions/updateCliente';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  cpf: z.string().min(11, { message: 'CPF deve ter 11 dígitos.' }).max(14).optional().or(z.literal('')),
  birthDate: z.date().optional(),
  active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface Cliente {
  id?: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  file_urls?: string[];
  active?: boolean;
}

interface ClienteFormProps {
  cliente?: Cliente;
  onSuccess: () => void;
  onCancel?: () => void;
  modalMode?: boolean; // Se true, é no modal, se false é página direta
}

export function ClienteForm({ cliente, onSuccess, onCancel, modalMode = false }: ClienteFormProps) {
  const { toast } = useToast();
  const [createCliente, isCreating] = useMutateAction(createClienteAction);
  const [updateCliente, isUpdating] = useMutateAction(updateClienteAction);
  const [savedClienteId, setSavedClienteId] = useState<number | null>(null);

  // Set saved cliente ID when editing
  React.useEffect(() => {
    if (cliente?.id) {
      setSavedClienteId(cliente.id);
    }
  }, [cliente?.id]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: cliente?.name || '',
      address: cliente?.address || '',
      phone: cliente?.phone || '',
      email: cliente?.email || '',
      cpf: cliente?.cpf || '',
      birthDate: cliente?.birth_date ? new Date(cliente.birth_date) : undefined,
      active: cliente?.active ?? true,
    },
  });

  const isSubmitting = isCreating || isUpdating;

  async function onSubmit(values: FormData) {
    try {
      const params = {
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        cpf: values.cpf || null,
        birthDate: values.birthDate ? values.birthDate.toISOString().split('T')[0] : null,
        active: values.active,
        fileUrls: [], // File URLs will be managed by FileManager
      };

      let clienteId: number;

      if (cliente?.id) {
        const result = await updateCliente({ ...params, id: cliente.id });
        clienteId = result[0]?.id || cliente.id;
        toast({ description: 'Cliente atualizado com sucesso!' });
      } else {
        const result = await createCliente(params);
        clienteId = result[0].id;
        setSavedClienteId(clienteId);
        toast({ description: 'Cliente criado com sucesso!' });
      }

      // Reset form only for new clients
      if (!cliente?.id) {
        form.reset();
        setSavedClienteId(null);
      }
      
      // Always call onSuccess to handle navigation/refresh
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        description: 'Erro ao salvar cliente. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-2xl">
          {cliente ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="main">Informações Principais</TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="vinculos" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Vínculos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input placeholder="João Silva" {...field} />
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
                          <Input type="email" placeholder="joao@exemplo.com" {...field} />
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
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <YearMonthDayPicker
                            date={field.value}
                            onDateChange={field.onChange}
                            placeholder="Selecionar data de nascimento"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Cliente Ativo</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Desative para ocultar da lista principal
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
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
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                {(savedClienteId || cliente?.id) ? (
                  <FileManager
                    entityType="cliente_document"
                    entityId={savedClienteId || cliente!.id}
                    acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    title="Documentos do Cliente"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Salve o cliente primeiro para fazer upload de documentos.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="vinculos" className="space-y-6">
                {(savedClienteId || cliente?.id) ? (
                  <ClienteVinculos clienteId={savedClienteId || cliente!.id} />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Salve o cliente primeiro para visualizar vínculos.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-4 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : cliente ? 'Atualizar' : 'Criar Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
