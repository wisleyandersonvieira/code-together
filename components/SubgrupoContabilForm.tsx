'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import createSubgrupoContabilAction from '@/actions/createSubgrupoContabil';
import updateSubgrupoContabilAction from '@/actions/updateSubgrupoContabil';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import fixSubgruposContabeisSequenceAction from '@/actions/fixSubgruposContabeisSequence';

const subgrupoContabilSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  grupoId: z.string().min(1, 'Grupo é obrigatório'),
  funcao: z.enum(['Crédito', 'Débito'], { 
    required_error: 'Função é obrigatória' 
  }),
});

type SubgrupoContabilFormData = z.infer<typeof subgrupoContabilSchema>;

interface SubgrupoContabilFormProps {
  subgrupo?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SubgrupoContabilForm({ subgrupo, onSuccess, onCancel }: SubgrupoContabilFormProps) {
  const { toast } = useToast();
  const isEditing = !!subgrupo;
  
  const [createSubgrupo, isCreating] = useMutateAction(createSubgrupoContabilAction);
  const [updateSubgrupo, isUpdating] = useMutateAction(updateSubgrupoContabilAction);
  const [fixSequence] = useMutateAction(fixSubgruposContabeisSequenceAction);
  const [grupos] = useLoadAction(loadGruposContabeisAction, []);

  const form = useForm<SubgrupoContabilFormData>({
    resolver: zodResolver(subgrupoContabilSchema),
    defaultValues: {
      descricao: '',
      grupoId: '',
      funcao: 'Crédito',
    },
  });

  useEffect(() => {
    if (subgrupo) {
      form.reset({
        descricao: subgrupo.descricao || '',
        grupoId: subgrupo.grupo_id?.toString() || '',
        funcao: subgrupo.funcao || 'Crédito',
      });
    }
  }, [subgrupo, form]);

  const onSubmit = async (data: SubgrupoContabilFormData) => {
    try {
      const payload = {
        descricao: data.descricao,
        grupoId: parseInt(data.grupoId),
        funcao: data.funcao,
      };

      if (isEditing) {
        await updateSubgrupo({ ...payload, id: subgrupo.id });
        toast({
          title: "Subgrupo atualizado",
          description: "O subgrupo contábil foi atualizado com sucesso.",
        });
      } else {
        await createSubgrupo(payload);
        toast({
          title: "Subgrupo criado",
          description: "O novo subgrupo contábil foi criado com sucesso.",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving subgrupo:', error);
      
      if (!isEditing && error?.message?.includes('id must be unique')) {
        try {
          // Fix sequence and try again
          await fixSequence();
          await createSubgrupo({ descricao: data.descricao, grupoId: parseInt(data.grupoId), funcao: data.funcao });
          toast({
            title: "Subgrupo criado",
            description: "O novo subgrupo contábil foi criado com sucesso.",
          });
          onSuccess();
        } catch (retryError) {
          toast({
            title: "Erro",
            description: "Não foi possível criar o subgrupo contábil.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Erro",
          description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} o subgrupo contábil.`,
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
            {isEditing ? 'Editar Subgrupo Contábil' : 'Novo Subgrupo Contábil'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing 
              ? 'Atualize as informações do subgrupo contábil' 
              : 'Cadastre um novo subgrupo contábil'
            }
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Subgrupo</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Vendas à Vista" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="grupoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o grupo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grupos.map((grupo: any) => (
                            <SelectItem key={grupo.id} value={grupo.id.toString()}>
                              {grupo.tipo} - {grupo.descricao}
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
                  name="funcao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Crédito">Crédito</SelectItem>
                          <SelectItem value="Débito">Débito</SelectItem>
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
