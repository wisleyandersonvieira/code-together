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
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { FileManager } from './FileManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Link, UserRound, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ClienteVinculos } from './ClienteVinculos';
import { useMutateAction } from '@uibakery/data';
import createClienteAction from '@/actions/createCliente';
import updateClienteAction from '@/actions/updateCliente';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const clienteFieldClassName =
  'h-11 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';

const clienteTextareaClassName =
  'min-h-[110px] rounded-2xl border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';

const clienteTabsListClassName =
  'grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-2 shadow-sm sm:grid-cols-3';

const clienteTabsTriggerClassName =
  'min-h-[46px] rounded-xl border border-transparent bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-slate-200 hover:bg-white hover:text-slate-900 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm';

const clientePrimaryButtonClassName =
  'h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_16px_30px_-20px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_20px_36px_-20px_rgba(15,23,42,0.55)] focus-visible:ring-4 focus-visible:ring-slate-200';

const clienteSecondaryButtonClassName =
  'h-11 rounded-xl border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

const clienteMutedPanelClassName =
  'rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm';

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
    resolver: zodResolver(formSchema),
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Tente novamente.';
      toast({
        description: `Erro ao salvar cliente: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_60px_-32px_rgba(15,23,42,0.35)]">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50/70 to-white px-6 py-4 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
              <UserRound className="h-5 w-5 text-slate-700" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Provision</p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                {cliente ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
              </CardTitle>
            </div>
          </div>

          {modalMode && onCancel ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onCancel}
              className="h-10 w-10 rounded-xl border-slate-200 bg-white text-slate-500 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-6 py-5 sm:px-7">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className={clienteTabsListClassName}>
                <TabsTrigger value="main" className={clienteTabsTriggerClassName}>
                  Informações Principais
                </TabsTrigger>
                <TabsTrigger value="documents" className={cn(clienteTabsTriggerClassName, 'flex items-center gap-2')}>
                  <FileText className="h-4 w-4" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="vinculos" className={cn(clienteTabsTriggerClassName, 'flex items-center gap-2')}>
                  <Link className="h-4 w-4" />
                  Vínculos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-sm font-semibold text-slate-700">Nome *</FormLabel>
                        <FormControl>
                          <Input className={clienteFieldClassName} placeholder="João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-sm font-semibold text-slate-700">Email</FormLabel>
                        <FormControl>
                          <Input className={clienteFieldClassName} type="email" placeholder="joao@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-sm font-semibold text-slate-700">Telefone</FormLabel>
                        <FormControl>
                          <Input className={clienteFieldClassName} placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-sm font-semibold text-slate-700">CPF</FormLabel>
                        <FormControl>
                          <Input className={clienteFieldClassName} placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-sm font-semibold text-slate-700">Data de Nascimento</FormLabel>
                        <FormControl>
                          <DatePickerWithYearSelector
                            date={field.value}
                            onDateChange={field.onChange}
                            placeholder="Selecionar data de nascimento"
                            triggerClassName={clienteFieldClassName}
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
                      <FormItem className="flex min-h-[68px] flex-row items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
                        <div className="space-y-1">
                          <FormLabel className="text-sm font-semibold text-slate-800">Cliente Ativo</FormLabel>
                          <div className="text-sm leading-5 text-slate-500">
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
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-sm font-semibold text-slate-700">Endereço</FormLabel>
                      <FormControl>
                        <Textarea className={clienteTextareaClassName} placeholder="Rua, número, bairro, cidade, estado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="documents" className="mt-4 space-y-4">
                {(savedClienteId || cliente?.id) ? (
                  <FileManager
                    entityType="cliente_document"
                    entityId={savedClienteId || cliente!.id}
                    acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    title="Documentos do Cliente"
                  />
                ) : (
                  <Card className={clienteMutedPanelClassName}>
                    <CardContent className="p-0 text-center text-sm leading-6 text-slate-500">
                      <p>Salve o cliente primeiro para fazer upload de documentos.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="vinculos" className="mt-4 space-y-4">
                {(savedClienteId || cliente?.id) ? (
                  <ClienteVinculos clienteId={savedClienteId || cliente!.id} />
                ) : (
                  <Card className={clienteMutedPanelClassName}>
                    <CardContent className="p-0 text-center text-sm leading-6 text-slate-500">
                      <p>Salve o cliente primeiro para visualizar vínculos.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} className={clienteSecondaryButtonClassName}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className={clientePrimaryButtonClassName}>
                {isSubmitting ? 'Salvando...' : cliente ? 'Atualizar' : 'Criar Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
