'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import createGrupoContabilAction from '@/actions/createGrupoContabil';
import updateGrupoContabilAction from '@/actions/updateGrupoContabil';
import fixGruposContabeisSequenceAction from '@/actions/fixGruposContabeisSequence';

const grupoContabilSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo: z.enum(['Receita', 'Despesa', 'Investimento', 'Distribuição'], { 
    required_error: 'Tipo é obrigatório' 
  }),
});

type GrupoContabilFormData = z.infer<typeof grupoContabilSchema>;

interface GrupoContabilFormProps {
  grupo?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function GrupoContabilForm({ grupo, onSuccess, onCancel }: GrupoContabilFormProps) {
  const { toast } = useToast();
  const isEditing = !!grupo;
  
  const [createGrupo, isCreating] = useMutateAction(createGrupoContabilAction);
  const [updateGrupo, isUpdating] = useMutateAction(updateGrupoContabilAction);
  const [fixSequence] = useMutateAction(fixGruposContabeisSequenceAction);

  const form = useForm<GrupoContabilFormData>({
    resolver: zodResolver(grupoContabilSchema),
    defaultValues: {
      descricao: '',
      tipo: 'Receita',
    },
  });

  useEffect(() => {
    if (grupo) {
      form.reset({
        descricao: grupo.descricao || '',
        tipo: grupo.tipo || 'Receita',
      });
    }
  }, [grupo, form]);

  const onSubmit = async (data: GrupoContabilFormData) => {
    try {
      const payload = {
        descricao: data.descricao,
        tipo: data.tipo,
      };

      if (isEditing) {
        await updateGrupo({ ...payload, id: grupo.id });
        toast({
          title: "Grupo atualizado",
          description: "O grupo contábil foi atualizado com sucesso.",
        });
      } else {
        await createGrupo(payload);
        toast({
          title: "Grupo criado",
          description: "O novo grupo contábil foi criado com sucesso.",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving grupo:', error);
      
      if (!isEditing && error?.message?.includes('id must be unique')) {
        try {
          // Fix sequence and try again
          await fixSequence();
          await createGrupo(payload);
          toast({
            title: "Grupo criado",
            description: "O novo grupo contábil foi criado com sucesso.",
          });
          onSuccess();
        } catch (retryError) {
          toast({
            title: "Erro",
            description: "Não foi possível criar o grupo contábil.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Erro",
          description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} o grupo contábil.`,
          variant: "destructive",
        });
      }
    }
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Editar Grupo Contábil' : 'Novo Grupo Contábil'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing 
              ? 'Atualize as informações do grupo contábil' 
              : 'Cadastre um novo grupo contábil'
            }
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Receitas de Vendas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Receita">Receita</SelectItem>
                          <SelectItem value="Despesa">Despesa</SelectItem>
                          <SelectItem value="Investimento">Investimento</SelectItem>
                          <SelectItem value="Distribuição">Distribuição</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting 
                    ? (isEditing ? 'Atualizando...' : 'Criando...')
                    : (isEditing ? 'Atualizar' : 'Criar')
                  }
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
