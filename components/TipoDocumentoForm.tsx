'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import createTipoDocumentoAction from '@/actions/createTipoDocumento';
import updateTipoDocumentoAction from '@/actions/updateTipoDocumento';

const formSchema = z.object({
  descricao: z.string().min(2, {
    message: 'Descrição deve ter pelo menos 2 caracteres.',
  }),
  mascara: z.string().min(1, {
    message: 'Máscara é obrigatória.',
  }),
});

interface TipoDocumentoFormProps {
  tipoDocumento?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TipoDocumentoForm({ tipoDocumento, onSuccess, onCancel }: TipoDocumentoFormProps) {
  const { toast } = useToast();
  const [createTipoDocumento, isCreating] = useMutateAction(createTipoDocumentoAction);
  const [updateTipoDocumento, isUpdating] = useMutateAction(updateTipoDocumentoAction);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: tipoDocumento?.descricao || '',
      mascara: tipoDocumento?.mascara || '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (tipoDocumento) {
        await updateTipoDocumento({ ...values, id: tipoDocumento.id });
        toast({
          title: "Tipo de documento atualizado",
          description: "O tipo de documento foi atualizado com sucesso.",
        });
      } else {
        await createTipoDocumento(values);
        toast({
          title: "Tipo de documento criado",
          description: "O tipo de documento foi criado com sucesso.",
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving tipo documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o tipo de documento.",
        variant: "destructive",
      });
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
            {tipoDocumento ? 'Editar Tipo de Documento' : 'Novo Tipo de Documento'}
          </h2>
          <p className="text-muted-foreground">
            {tipoDocumento ? 'Altere as informações do tipo de documento' : 'Preencha os dados do novo tipo de documento'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Tipo de Documento</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {tipoDocumento && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">Código: {tipoDocumento.codigo}</p>
                </div>
              )}

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite a descrição do tipo de documento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mascara"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máscara</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ###.###.###-## ou ##.###.###/####-##" {...field} />
                    </FormControl>
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
                  {tipoDocumento ? 'Atualizar' : 'Salvar'} Cadastro
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
