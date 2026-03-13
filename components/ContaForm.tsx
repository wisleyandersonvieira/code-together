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
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import createContaAction from '@/actions/createConta';
import updateContaAction from '@/actions/updateConta';
import fixContasSequenceAction from '@/actions/fixContasSequence';

const contaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  banco: z.string().min(1, 'Banco é obrigatório'),
  descricao: z.string().optional(),
  saldoInicial: z.string().min(1, 'Saldo inicial é obrigatório'),
  dataSaldoInicial: z.date({ required_error: 'Data do saldo inicial é obrigatória' }),
  destaque: z.boolean().default(false),
});

type ContaFormData = z.infer<typeof contaSchema>;

interface ContaFormProps {
  conta?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContaForm({ conta, onSuccess, onCancel }: ContaFormProps) {
  const { toast } = useToast();
  const isEditing = !!conta;
  
  const [createConta, isCreating] = useMutateAction(createContaAction);
  const [updateConta, isUpdating] = useMutateAction(updateContaAction);
  const [fixSequence] = useMutateAction(fixContasSequenceAction);

  const form = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
    defaultValues: {
      nome: '',
      numero: '',
      banco: '',
      descricao: '',
      saldoInicial: '',
      dataSaldoInicial: new Date(),
      destaque: false,
    },
  });

  useEffect(() => {
    if (conta) {
      form.reset({
        nome: conta.nome || '',
        numero: conta.numero || '',
        banco: conta.banco || '',
        descricao: conta.descricao || '',
        saldoInicial: conta.saldo_inicial?.toString() || '',
        dataSaldoInicial: new Date(conta.data_saldo_inicial),
        destaque: conta.destaque || false,
      });
    }
  }, [conta, form]);

  const onSubmit = async (data: ContaFormData) => {
    try {
      const payload = {
        nome: data.nome,
        numero: data.numero,
        banco: data.banco,
        descricao: data.descricao,
        saldoInicial: parseFloat(data.saldoInicial),
        dataSaldoInicial: data.dataSaldoInicial.toISOString().split('T')[0],
        destaque: data.destaque,
      };

      if (isEditing) {
        await updateConta({ ...payload, id: conta.id });
        toast({
          title: "Conta atualizada",
          description: "A conta foi atualizada com sucesso.",
        });
      } else {
        await createConta(payload);
        toast({
          title: "Conta criada",
          description: "A nova conta foi criada com sucesso.",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving conta:', error);
      
      if (!isEditing && error?.message?.includes('id must be unique')) {
        try {
          // Fix sequence and try again
          await fixSequence();
          await createConta(payload);
          toast({
            title: "Conta criada",
            description: "A nova conta foi criada com sucesso.",
          });
          onSuccess();
        } catch (retryError) {
          toast({
            title: "Erro",
            description: "Não foi possível criar a conta.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Erro",
          description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} a conta.`,
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
            {isEditing ? 'Editar Conta' : 'Nova Conta'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing 
              ? 'Atualize as informações da conta corrente' 
              : 'Cadastre uma nova conta corrente'
            }
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Conta</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Conta Corrente Principal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Conta</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 12345-6" className="max-w-xs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Descrição opcional da conta" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                  <FormField
                    control={form.control}
                    name="banco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Banco do Brasil" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="saldoInicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Inicial</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="dataSaldoInicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data do Saldo Inicial</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value}
                            onDateChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="destaque"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Destacar no Dashboard
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Esta conta será exibida no card "Saldo Contas" do dashboard
                        </p>
                      </div>
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
