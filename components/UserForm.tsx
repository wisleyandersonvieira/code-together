'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutateAction } from '@uibakery/data';
import { hashPassword } from '@/lib/crypto';
import createUserAction from '@/actions/createUser';
import createUserWithPasswordAction from '@/actions/createUserWithPassword';
import updateUserAction from '@/actions/updateUser';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  email: z.string().email({ message: 'Email inválido.' }),
  phone: z.string().min(10, { message: 'Telefone deve ter pelo menos 10 dígitos.' }).optional().or(z.literal('')),
  role: z.string().optional(),
  status: z.string().optional(),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres.' }).optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Senhas não coincidem.',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof formSchema>;

interface User {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
}

interface UserFormProps {
  user?: User;
  onSuccess: () => void;
  onCancel?: () => void;
  isAdminView?: boolean;
}

export function UserForm({ user, onSuccess, onCancel, isAdminView = false }: UserFormProps) {
  const { toast } = useToast();
  const [createUser, isCreating] = useMutateAction(createUserAction);
  const [createUserWithPassword, isCreatingWithPassword] = useMutateAction(createUserWithPasswordAction);
  const [updateUser, isUpdating] = useMutateAction(updateUserAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || (isAdminView ? 'user' : ''),
      status: user?.status || (isAdminView ? 'active' : ''),
      password: '',
      confirmPassword: '',
    },
  });

  const isSubmitting = isCreating || isCreatingWithPassword || isUpdating;

  async function onSubmit(values: FormData) {
    try {
      if (user?.id) {
        await updateUser({
          id: user.id,
          name: values.name,
          email: values.email,
          phone: values.phone || null,
          role: values.role,
          status: values.status,
        });
        toast({
          description: 'Usuário atualizado com sucesso!',
        });
      } else {
        const hasPassword = isAdminView && values.password && values.password.length > 0;
        
        if (hasPassword) {
          const passwordHash = await hashPassword(values.password!);

          await createUserWithPassword({
            name: values.name,
            email: values.email,
            phone: values.phone || null,
            role: values.role,
            status: values.status,
            passwordHash,
          });
        } else {
          const userData = {
            name: values.name,
            email: values.email,
            phone: values.phone || null,
            role: isAdminView ? values.role : 'user',
            status: isAdminView ? values.status : 'pending',
          };
          
          await createUser(userData);
        }
        
        toast({
          description: isAdminView ? 'Usuário criado com sucesso!' : 'Cadastro realizado! Aguarde aprovação do administrador.',
        });
      }
      form.reset();
      onSuccess();
    } catch {
      toast({
        description: 'Erro ao salvar usuário. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">
          {user ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="joao@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isAdminView && (
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Papel</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um papel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {isAdminView && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!user && isAdminView && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha (Opcional)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : user ? 'Atualizar' : 'Criar Usuário'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
