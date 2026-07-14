'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { supabase } from '@/src/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(8, { message: 'Senha deve ter pelo menos 8 caracteres.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem.',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof formSchema>;

export function SetPasswordForm() {
  const { toast } = useToast();
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: FormData) {
    setIsSettingPassword(true);
    try {
      // A senha de login vive no GoTrue. A edge function exige sessão + role
      // admin e cria a conta caso ela ainda não exista (ex.: usuário que se
      // cadastrou pela tela pública e foi aprovado).
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'set-password',
          email: values.email,
          password: values.password,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Falha ao definir a senha.');
      }

      toast({
        description: data?.data?.[0]?.created
          ? `Conta de acesso criada e senha definida para ${values.email}!`
          : `Senha definida com sucesso para ${values.email}!`,
      });
      form.reset();
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Erro ao definir senha. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSettingPassword(false);
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
