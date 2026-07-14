'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText } from 'lucide-react';
import { Trash2, Plus } from 'lucide-react';
import { FileManager } from './FileManager';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import createEmpresaAction from '@/actions/createEmpresa';
import updateEmpresaAction from '@/actions/updateEmpresa';
import createEmpresaClientesAction from '@/actions/createEmpresaClientes';
import deleteEmpresaClientesAction from '@/actions/deleteEmpresaClientes';
import loadClientesAction from '@/actions/loadClientes';
import fixEmpresasSequenceAction from '@/actions/fixEmpresasSequence';
import { useToast } from '@/hooks/use-toast';

const clienteSchema = z.object({
  clienteId: z.string().min(1, 'Selecione um cliente'),
  percentage: z.number().min(0.01, 'Porcentagem deve ser maior que 0').max(100, 'Porcentagem não pode ser maior que 100'),
});

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  number: z.string().optional(),
  clientes: z.array(clienteSchema).min(1, 'Adicione pelo menos um cliente'),
});

type FormData = z.infer<typeof formSchema>;

interface Empresa {
  id?: number;
  name: string;
  number?: string;
  file_urls?: string[];
  clientes?: Array<{
    cliente_id: number;
    cliente_name: string;
    percentage: number;
  }>;
}

interface EmpresaFormProps {
  empresa?: Empresa;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function EmpresaForm({ empresa, onSuccess, onCancel }: EmpresaFormProps) {
  const { toast } = useToast();
  const [createEmpresa, isCreating] = useMutateAction(createEmpresaAction);
  const [fixSequence] = useMutateAction(fixEmpresasSequenceAction);
  const [updateEmpresa, isUpdating] = useMutateAction(updateEmpresaAction);
  const [createEmpresaClientes] = useMutateAction(createEmpresaClientesAction);
  const [deleteEmpresaClientes] = useMutateAction(deleteEmpresaClientesAction);
  const [clientes] = useLoadAction(loadClientesAction, []);
  const [savedEmpresaId, setSavedEmpresaId] = useState<number | null>(null);

  // Set saved empresa ID when editing
  React.useEffect(() => {
    if (empresa?.id) {
      setSavedEmpresaId(empresa.id);
    }
  }, [empresa?.id]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: empresa?.name || '',
      number: empresa?.number || '',
      clientes: empresa?.clientes?.map(c => ({
        clienteId: c.cliente_id.toString(),
        percentage: c.percentage,
      })) || [{ clienteId: '', percentage: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'clientes',
  });

  const isSubmitting = isCreating || isUpdating;

  // Calculate total percentage
  const watchedClientes = form.watch('clientes');
  const totalPercentage = watchedClientes.reduce((sum, cliente) => sum + (cliente.percentage || 0), 0);

  async function onSubmit(values: FormData) {
    // Validate total percentage
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({
        description: 'A soma das porcentagens deve ser exatamente 100%.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let empresaId: number;

      if (empresa?.id) {
        const result = await updateEmpresa({
          id: empresa.id,
          name: values.name.trim(),
          number: values.number?.trim() || null,
          fileUrls: [], // File URLs will be managed by FileManager
        });
        empresaId = result[0].id;

        // Delete existing relationships
        await deleteEmpresaClientes({ empresaId: empresa.id });
      } else {
        try {
          const result = await createEmpresa({
            name: values.name.trim(),
            number: values.number?.trim() || null,
            fileUrls: [], // File URLs will be managed by FileManager
          });
          empresaId = result[0].id;
          setSavedEmpresaId(empresaId);
        } catch (error: any) {
          if (error?.message?.includes('id must be unique')) {
            // Fix sequence and try again
            await fixSequence();
            const result = await createEmpresa({
              name: values.name.trim(),
              number: values.number?.trim() || null,
              fileUrls: [], // File URLs will be managed by FileManager
            });
            empresaId = result[0].id;
            setSavedEmpresaId(empresaId);
          } else {
            throw error;
          }
        }
      }

      // Create new relationships
      for (const cliente of values.clientes) {
        
        await createEmpresaClientes({
          empresaId,
          clienteId: parseInt(cliente.clienteId),
          percentage: cliente.percentage,
        });
      }

      toast({
        description: empresa ? 'Empresa atualizada com sucesso!' : 'Empresa criada com sucesso!',
      });

      // Reset form only for new empresas
      if (!empresa?.id) {
        form.reset();
        setSavedEmpresaId(null);
      }
      
      // Always call onSuccess to handle navigation/refresh
      onSuccess();
    } catch (error) {
      toast({
        description: 'Erro ao salvar empresa. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-2xl">
          {empresa ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="main">Informações Principais</TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="Número da empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium">Clientes e Participação</h3>
                  <p className="text-sm text-muted-foreground">
                    Total: {totalPercentage.toFixed(2)}%
                    {Math.abs(totalPercentage - 100) > 0.01 && (
                      <Badge variant="destructive" className="ml-2">
                        Deve somar 100%
                      </Badge>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ clienteId: '', percentage: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cliente
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border rounded">
                  <FormField
                    control={form.control}
                    name={`clientes.${index}.clienteId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map((cliente: any) => (
                              <SelectItem key={cliente.id} value={cliente.id.toString()}>
                                {cliente.name}
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
                    name={`clientes.${index}.percentage`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Porcentagem (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                {(savedEmpresaId || empresa?.id) ? (
                  <FileManager
                    entityType="empresa_document"
                    entityId={savedEmpresaId || empresa!.id}
                    acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    title="Documentos da Empresa"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Salve a empresa primeiro para fazer upload de documentos.</p>
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
                {isSubmitting ? 'Salvando...' : empresa ? 'Atualizar' : 'Criar Empresa'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
