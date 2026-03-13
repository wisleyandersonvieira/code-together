'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
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
import createGrupoAction from '@/actions/createGrupo';
import updateGrupoAction from '@/actions/updateGrupo';
import createGrupoMemberAction from '@/actions/createGrupoMember';
import deleteGrupoMembersAction from '@/actions/deleteGrupoMembers';
import loadClientesAction from '@/actions/loadClientes';
import loadEmpresasAction from '@/actions/loadEmpresas';
import fixGruposSequenceAction from '@/actions/fixGruposSequence';
import { useToast } from '@/hooks/use-toast';

const memberSchema = z.object({
  type: z.enum(['cliente', 'empresa'], { message: 'Selecione o tipo' }),
  id: z.string().min(1, 'Selecione um cliente ou empresa'),
  percentage: z.number().min(0.01, 'Porcentagem deve ser maior que 0').max(100, 'Porcentagem não pode ser maior que 100'),
});

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  members: z.array(memberSchema).min(1, 'Adicione pelo menos um membro ao grupo'),
});

type FormData = z.infer<typeof formSchema>;

interface Grupo {
  id?: number;
  name: string;
  file_urls?: string[];
  members?: Array<{
    cliente_id?: number;
    empresa_id?: number;
    cliente_name?: string;
    empresa_name?: string;
    percentage: number;
  }>;
}

interface GrupoFormProps {
  grupo?: Grupo;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function GrupoForm({ grupo, onSuccess, onCancel }: GrupoFormProps) {
  const { toast } = useToast();
  const [createGrupo, isCreating] = useMutateAction(createGrupoAction);
  const [fixSequence] = useMutateAction(fixGruposSequenceAction);
  const [updateGrupo, isUpdating] = useMutateAction(updateGrupoAction);
  const [createGrupoMember] = useMutateAction(createGrupoMemberAction);
  const [deleteGrupoMembers] = useMutateAction(deleteGrupoMembersAction);
  const [clientes] = useLoadAction(loadClientesAction, []);
  const [empresas] = useLoadAction(loadEmpresasAction, []);
  const [savedGrupoId, setSavedGrupoId] = useState<number | null>(null);

  // Set saved grupo ID when editing
  React.useEffect(() => {
    if (grupo?.id) {
      setSavedGrupoId(grupo.id);
    }
  }, [grupo?.id]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: grupo?.name || '',
      members: grupo?.members?.map(m => ({
        type: m.cliente_id ? 'cliente' as const : 'empresa' as const,
        id: (m.cliente_id || m.empresa_id)?.toString() || '',
        percentage: m.percentage,
      })) || [{ type: 'cliente' as const, id: '', percentage: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'members',
  });

  const isSubmitting = isCreating || isUpdating;

  // Calculate total percentage
  const watchedMembers = form.watch('members');
  const totalPercentage = watchedMembers.reduce((sum, member) => sum + (member.percentage || 0), 0);

  // Get available options based on selected type
  const getAvailableOptions = (type: 'cliente' | 'empresa') => {
    return type === 'cliente' ? clientes : empresas;
  };

  const getMemberName = (type: 'cliente' | 'empresa', id: string) => {
    const options = getAvailableOptions(type);
    const option = options.find((item: any) => item.id.toString() === id);
    return option?.name || '';
  };

  async function onSubmit(values: FormData) {
    // Validate total percentage
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({
        description: 'A soma das porcentagens deve ser exatamente 100%.',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate members
    const memberKeys = values.members.map(m => `${m.type}-${m.id}`);
    const uniqueKeys = new Set(memberKeys);
    if (memberKeys.length !== uniqueKeys.size) {
      toast({
        description: 'Não é possível adicionar o mesmo membro mais de uma vez.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let grupoId: number;

      if (grupo?.id) {
        const result = await updateGrupo({
          id: grupo.id,
          name: values.name.trim(),
          fileUrls: [], // File URLs will be managed by FileManager
        });
        grupoId = result[0].id;

        // Delete existing relationships
        await deleteGrupoMembers({ grupoId: grupo.id });
      } else {
        try {
          const result = await createGrupo({
            name: values.name.trim(),
            fileUrls: [], // File URLs will be managed by FileManager
          });
          grupoId = result[0].id;
          setSavedGrupoId(grupoId);
        } catch (error: any) {
          if (error?.message?.includes('id must be unique')) {
            // Fix sequence and try again
            await fixSequence();
            const result = await createGrupo({
              name: values.name.trim(),
              fileUrls: [], // File URLs will be managed by FileManager
            });
            grupoId = result[0].id;
            setSavedGrupoId(grupoId);
          } else {
            throw error;
          }
        }
      }

      // Create new member relationships
      for (const member of values.members) {
        const params = {
          grupoId,
          clienteId: member.type === 'cliente' ? parseInt(member.id) : null,
          empresaId: member.type === 'empresa' ? parseInt(member.id) : null,
          percentage: member.percentage,
        };

        console.log('Creating grupo member relationship:', params);
        
        await createGrupoMember(params);
      }

      toast({
        description: grupo ? 'Grupo atualizado com sucesso!' : 'Grupo criado com sucesso!',
      });

      // Reset form only for new grupos
      if (!grupo?.id) {
        form.reset();
        setSavedGrupoId(null);
      }
      
      // Always call onSuccess to handle navigation/refresh
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar grupo:', error);
      toast({
        description: 'Erro ao salvar grupo. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-2xl">
          {grupo ? 'Editar Grupo' : 'Cadastrar Novo Grupo de Clientes'}
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
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Grupo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do grupo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium">Membros do Grupo</h3>
                  <p className="text-sm text-muted-foreground">
                    Total: {totalPercentage.toFixed(2)}%
                    {Math.abs(totalPercentage - 100) > 0.01 && (
                      <Badge variant="destructive" className="ml-2">
                        Deve somar 100%
                      </Badge>
                    )}
                    {Math.abs(totalPercentage - 100) <= 0.01 && (
                      <Badge variant="default" className="ml-2">
                        ✓ Válido
                      </Badge>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ type: 'cliente', id: '', percentage: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Membro
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border rounded">
                  <FormField
                    control={form.control}
                    name={`members.${index}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Reset the id when type changes
                            form.setValue(`members.${index}.id`, '');
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cliente">Cliente</SelectItem>
                            <SelectItem value="empresa">Empresa</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`members.${index}.id`}
                    render={({ field }) => {
                      const memberType = form.watch(`members.${index}.type`);
                      const options = getAvailableOptions(memberType);
                      
                      return (
                        <FormItem>
                          <FormLabel>
                            {memberType === 'cliente' ? 'Cliente *' : 'Empresa *'}
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={`Selecione ${memberType === 'cliente' ? 'um cliente' : 'uma empresa'}`} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {options.map((option: any) => (
                                <SelectItem key={option.id} value={option.id.toString()}>
                                  {option.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name={`members.${index}.percentage`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Porcentagem (%) *</FormLabel>
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

              {fields.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded">
                  <h4 className="text-sm font-medium mb-2">Resumo do Grupo:</h4>
                  <div className="space-y-1 text-sm">
                    {watchedMembers.map((member, idx) => {
                      if (!member.id || !member.type) return null;
                      const memberName = getMemberName(member.type, member.id);
                      return (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {memberName} ({member.type === 'cliente' ? 'Cliente' : 'Empresa'})
                          </span>
                          <span className="font-medium">{member.percentage}%</span>
                        </div>
                      );
                    })}
                    <div className="border-t pt-1 mt-2 font-medium">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className={totalPercentage === 100 ? 'text-green-600' : 'text-red-600'}>
                          {totalPercentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                {(savedGrupoId || grupo?.id) ? (
                  <FileManager
                    entityType="grupo_document"
                    entityId={savedGrupoId || grupo!.id}
                    acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    title="Documentos do Grupo"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Salve o grupo primeiro para fazer upload de documentos.</p>
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
                {isSubmitting ? 'Salvando...' : grupo ? 'Atualizar Grupo' : 'Criar Grupo'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
