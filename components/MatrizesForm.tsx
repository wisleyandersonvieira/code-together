'use client';

import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Building, Plus, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FileManager } from '@/components/FileManager';
import loadSociosAction from '@/actions/loadSocios';
import loadMatrizSociosAction from '@/actions/loadMatrizSocios';
import createMatrizAction from '@/actions/createMatriz';
import updateMatrizAction from '@/actions/updateMatriz';
import createMatrizSocioAction from '@/actions/createMatrizSocio';
import deleteMatrizSociosAction from '@/actions/deleteMatrizSocios';

const socioSchema = z.object({
  socio_id: z.number().min(1, 'Sócio é obrigatório'),
  percentual_participacao: z.number().min(0.01, 'Percentual deve ser maior que zero').max(100, 'Percentual não pode ser maior que 100'),
});

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cnpj_ein: z.string().optional(),
  endereco: z.string().optional(),
  socios: z.array(socioSchema).min(1, 'Adicione pelo menos um sócio'),
});

interface MatrizesFormProps {
  matriz?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MatrizesForm({ matriz, onSuccess, onCancel }: MatrizesFormProps) {
  const { toast } = useToast();
  const [matrizId, setMatrizId] = useState<number | null>(matriz?.id || null);
  const isEditing = !!matriz;

  // Data loading
  const [socios] = useLoadAction(loadSociosAction, [], { searchNome: null });
  const [existingSocios] = useLoadAction(loadMatrizSociosAction, [], { matrizId: matriz?.id || null });

  // Mutations
  const [createMatriz, isCreating] = useMutateAction(createMatrizAction);
  const [updateMatriz, isUpdating] = useMutateAction(updateMatrizAction);
  const [createMatrizSocio] = useMutateAction(createMatrizSocioAction);
  const [deleteMatrizSocios] = useMutateAction(deleteMatrizSociosAction);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: matriz?.nome || '',
      cnpj_ein: matriz?.cnpj_ein || '',
      endereco: matriz?.endereco || '',
      socios: [],
    },
  });

  const { fields: sociosFields, append: appendSocio, remove: removeSocio } = useFieldArray({
    control: form.control,
    name: 'socios',
  });

  // Load existing socios when editing
  React.useEffect(() => {
    if (isEditing && existingSocios && existingSocios.length > 0 && sociosFields.length === 0) {
      existingSocios.forEach((socio: any) => {
        appendSocio({
          socio_id: socio.socio_id,
          percentual_participacao: parseFloat(socio.percentual_participacao) || 0,
        });
      });
    }
  }, [existingSocios, isEditing, sociosFields.length, appendSocio]);

  const watchedSocios = form.watch('socios') || [];

  // Calculate total participation percentage
  const totalPercentual = watchedSocios.reduce((total, socio) => {
    return total + (socio.percentual_participacao || 0);
  }, 0);

  const addSocio = () => {
    appendSocio({
      socio_id: 0,
      percentual_participacao: 0,
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Validation
    if (Math.abs(totalPercentual - 100) > 0.01) {
      toast({
        title: "Erro de validação",
        description: "O total de participação dos sócios deve ser exatamente 100%",
        variant: "destructive",
      });
      return;
    }

    try {
      let currentMatrizId: number;

      const submitData = {
        nome: values.nome,
        cnpjEin: values.cnpj_ein || null,
        endereco: values.endereco || null,
      };

      if (isEditing) {
        // Update existing matriz
        await updateMatriz({
          id: matriz.id,
          ...submitData,
        });
        currentMatrizId = matriz.id;

        // Delete existing socios relationships
        await deleteMatrizSocios({ matrizId: matriz.id });
      } else {
        // Create new matriz
        const matrizResult = await createMatriz(submitData);
        currentMatrizId = matrizResult[0].id;
        setMatrizId(currentMatrizId);
      }

      // Create/recreate socios relationships
      for (const socio of values.socios) {
        await createMatrizSocio({
          matrizId: currentMatrizId,
          socioId: socio.socio_id,
          percentualParticipacao: socio.percentual_participacao,
        });
      }

      toast({
        title: isEditing ? "Matriz atualizada" : "Matriz criada",
        description: `Matriz foi ${isEditing ? 'atualizada' : 'criada'} com sucesso.`,
      });
      onSuccess();
    } catch (error) {
      console.error('Error saving matriz:', error);
      toast({
        title: "Erro",
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} a matriz.`,
        variant: "destructive",
      });
    }
  };

  const getSocioName = (socioId: number) => {
    const socio = socios?.find((s: any) => s.id === socioId);
    return socio ? socio.nome : 'Selecione um sócio';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Editar Matriz' : 'Nova Matriz'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing ? 'Edite os dados da matriz' : 'Preencha os dados da nova matriz'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="dados" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
              <TabsTrigger value="socios">Sócios</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Dados da Matriz
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o nome da matriz" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj_ein"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ ou EIN Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o CNPJ ou EIN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Digite o endereço completo"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="socios" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Participação Societária</CardTitle>
                  <Button type="button" variant="outline" onClick={addSocio}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Sócio
                  </Button>
                </CardHeader>
                <CardContent>
                  {sociosFields.length > 0 ? (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sócio</TableHead>
                            <TableHead>Participação (%)</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sociosFields.map((field, index) => (
                            <TableRow key={field.id}>
                              <TableCell className="w-[300px]">
                                <FormField
                                  control={form.control}
                                  name={`socios.${index}.socio_id`}
                                  render={({ field }) => (
                                    <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecionar sócio" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {socios?.map((socio: any) => (
                                          <SelectItem key={socio.id} value={socio.id.toString()}>
                                            {socio.nome}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`socios.${index}.percentual_participacao`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      max="100"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeSocio(index)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex justify-end">
                        <div className={`text-lg font-semibold ${Math.abs(totalPercentual - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                          Total: {totalPercentual.toFixed(2)}% / 100%
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum sócio adicionado. Clique em "Adicionar Sócio" para começar.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documentos" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Documentos da Matriz
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing && matrizId ? (
                    <FileManager
                      entityType="matriz"
                      entityId={matrizId}
                      acceptedTypes="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      title="Documentos da Matriz"
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Salve a matriz primeiro para poder anexar documentos.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="space-y-4">
            {/* Validation Status */}
            <div className="p-3 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Status de Validação</h4>
              <div className="space-y-1 text-sm">
                <div className={form.getValues('nome') ? 'text-green-600' : 'text-red-600'}>
                  ✓ Nome: {form.getValues('nome') || '(obrigatório)'}
                </div>
                <div className={sociosFields.length > 0 ? 'text-green-600' : 'text-red-600'}>
                  ✓ Sócios: {sociosFields.length} {sociosFields.length === 0 && '(adicione pelo menos 1 sócio)'}
                </div>
                <div className={Math.abs(totalPercentual - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}>
                  ✓ Participação: {totalPercentual.toFixed(2)}% {Math.abs(totalPercentual - 100) > 0.01 && '(deve ser exatamente 100%)'}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                type="submit" 
                disabled={
                  isCreating || 
                  isUpdating ||
                  !form.getValues('nome') || 
                  Math.abs(totalPercentual - 100) > 0.01 ||
                  sociosFields.length === 0
                }
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                {isEditing 
                  ? (isUpdating ? 'Salvando...' : 'Salvar Alterações')
                  : (isCreating ? 'Criando...' : 'Criar Matriz')
                }
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
