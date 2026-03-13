'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import createProdutoAction from '@/actions/createProduto';
import updateProdutoAction from '@/actions/updateProduto';
import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import loadSubgruposByGrupoAction from '@/actions/loadSubgruposByGrupo';
import fixProdutosSequenceAction from '@/actions/fixProdutosSequence';

const formSchema = z.object({
  descricao: z.string().min(2, {
    message: 'Descrição deve ter pelo menos 2 caracteres.',
  }),
  tipo: z.enum(['Produto', 'Servico'], {
    required_error: 'Selecione um tipo.',
  }),
  grupo_id: z.string().min(1, {
    message: 'Selecione um grupo.',
  }),
  subgrupo_id: z.string().min(1, {
    message: 'Selecione um subgrupo.',
  }),
});

interface ProductFormProps {
  produto?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductForm({ produto, onSuccess, onCancel }: ProductFormProps) {
  const { toast } = useToast();
  const [selectedGrupo, setSelectedGrupo] = useState<string>('');
  const [grupos] = useLoadAction(loadGruposContabeisAction, []);
  const [subgrupos, loadingSubgrupos] = useLoadAction(loadSubgruposByGrupoAction, [], { 
    grupo_id: selectedGrupo ? parseInt(selectedGrupo) : null 
  });
  const [createProduto, isCreating] = useMutateAction(createProdutoAction);
  const [updateProduto, isUpdating] = useMutateAction(updateProdutoAction);
  const [fixSequence] = useMutateAction(fixProdutosSequenceAction);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: produto?.descricao || '',
      tipo: produto?.tipo || '',
      grupo_id: produto?.grupo_id?.toString() || '',
      subgrupo_id: produto?.subgrupo_id?.toString() || '',
    },
  });

  useEffect(() => {
    if (produto?.grupo_id) {
      setSelectedGrupo(produto.grupo_id.toString());
    }
  }, [produto]);

  const handleGrupoChange = (value: string) => {
    setSelectedGrupo(value);
    form.setValue('grupo_id', value);
    form.setValue('subgrupo_id', ''); // Reset subgrupo when grupo changes
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const data = {
        ...values,
        grupo_id: parseInt(values.grupo_id),
        subgrupo_id: parseInt(values.subgrupo_id),
      };

      if (produto) {
        await updateProduto({ ...data, id: produto.id });
        toast({
          title: "Produto atualizado",
          description: "O produto/serviço foi atualizado com sucesso.",
        });
      } else {
        await createProduto(data);
        toast({
          title: "Produto criado",
          description: "O produto/serviço foi criado com sucesso.",
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving produto:', error);
      
      if (!produto && error?.message?.includes('id must be unique')) {
        try {
          // Fix sequence and try again
          await fixSequence();
          await createProduto(data);
          toast({
            title: "Produto criado",
            description: "O produto/serviço foi criado com sucesso.",
          });
          onSuccess();
        } catch (retryError) {
          toast({
            title: "Erro",
            description: "Não foi possível criar o produto/serviço.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível salvar o produto/serviço.",
          variant: "destructive",
        });
      }
    }
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
            {produto ? 'Editar Produto/Serviço' : 'Novo Produto/Serviço'}
          </h2>
          <p className="text-muted-foreground">
            {produto ? 'Altere as informações do produto/serviço' : 'Preencha os dados do novo produto/serviço'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Produto/Serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {produto && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">Código: {produto.codigo}</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite a descrição do produto/serviço" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Produto">Produto</SelectItem>
                        <SelectItem value="Servico">Serviço</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grupo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo</FormLabel>
                    <Select onValueChange={handleGrupoChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {grupos.map((grupo: any) => (
                          <SelectItem key={grupo.id} value={grupo.id.toString()}>
                            {grupo.descricao}
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
                name="subgrupo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subgrupo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedGrupo || loadingSubgrupos}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !selectedGrupo 
                              ? "Primeiro selecione um grupo" 
                              : loadingSubgrupos 
                                ? "Carregando subgrupos..." 
                                : "Selecione um subgrupo"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subgrupos?.map((subgrupo: any) => (
                          <SelectItem key={subgrupo.id} value={subgrupo.id.toString()}>
                            {subgrupo.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  disabled={isCreating || isUpdating}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {produto ? 'Atualizar' : 'Salvar'} Cadastro
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
