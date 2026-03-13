'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { YearMonthDayPicker } from '@/components/ui/year-month-day-picker';
import createSocioAction from '@/actions/createSocio';
import updateSocioAction from '@/actions/updateSocio';

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  cpf: z.string().optional(),
  data_nascimento: z.date().optional(),
  endereco: z.string().optional(),
});

interface SociosFormProps {
  socio?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SociosForm({ socio, onSuccess, onCancel }: SociosFormProps) {
  const { toast } = useToast();
  const isEditing = !!socio;

  // Mutations
  const [createSocio, isCreating] = useMutateAction(createSocioAction);
  const [updateSocio, isUpdating] = useMutateAction(updateSocioAction);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: socio?.nome || '',
      email: socio?.email || '',
      telefone: socio?.telefone || '',
      cpf: socio?.cpf || '',
      data_nascimento: socio?.data_nascimento ? new Date(socio.data_nascimento) : undefined,
      endereco: socio?.endereco || '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const submitData = {
        ...values,
        dataNascimento: values.data_nascimento?.toISOString().split('T')[0] || null,
        email: values.email || null,
        telefone: values.telefone || null,
        cpf: values.cpf || null,
        endereco: values.endereco || null,
      };

      if (isEditing) {
        await updateSocio({
          id: socio.id,
          ...submitData,
        });
        toast({
          title: "Sócio atualizado",
          description: "Sócio foi atualizado com sucesso.",
        });
      } else {
        await createSocio(submitData);
        toast({
          title: "Sócio criado",
          description: "Sócio foi criado com sucesso.",
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving socio:', error);
      toast({
        title: "Erro",
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} o sócio.`,
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
            {isEditing ? 'Editar Sócio' : 'Novo Sócio'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing ? 'Edite os dados do sócio' : 'Preencha os dados do novo sócio'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados do Sócio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o telefone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o CPF" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_nascimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <YearMonthDayPicker
                          date={field.value}
                          onDateChange={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  disabled={isCreating || isUpdating}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing 
                    ? (isUpdating ? 'Salvando...' : 'Salvar Alterações')
                    : (isCreating ? 'Criando...' : 'Criar Sócio')
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
