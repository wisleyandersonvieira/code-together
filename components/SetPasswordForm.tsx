'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutateAction } from '@uibakery/data';
import setUserPasswordAction from '@/actions/setUserPassword';
import { hashPassword } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem.',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof formSchema>;

export function SetPasswordForm() {
  const { toast } = useToast();
  const [setPassword, isSettingPassword] = useMutateAction(setUserPasswordAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: FormData) {
    try {
      const passwordHash = await hashPassword(values.password);
      
      const result = await setPassword({
        email: values.email,
        passwordHash: passwordHash,
      });

      if (result && result.length > 0) {
        toast({
          description: `Senha definida com sucesso para ${values.email}!`,
        });
        form.reset();
      } else {
        toast({
          description: 'Email não encontrado ou usuário inativo.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        description: 'Erro ao definir senha. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Definir Senha</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email do Usuário</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="usuario@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Senha</FormLabel>
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

            <Button type="submit" disabled={isSettingPassword} className="w-full">
              {isSettingPassword ? 'Definindo...' : 'Definir Senha'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
