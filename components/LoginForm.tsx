'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { supabase } from '@/src/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PasswordResetForm } from './PasswordResetForm';
import {
  AuthShell,
  authGhostButtonClassName,
  authInputClassName,
  authPrimaryButtonClassName,
} from './AuthShell';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(1, { message: 'Senha é obrigatória.' }),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm() {
  const { toast } = useToast();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: FormData) {
    setIsAuthenticating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast({
          description: error.message === 'Invalid login credentials'
            ? 'Email ou senha inválidos.'
            : error.message,
          variant: 'destructive',
        });
      } else {
        toast({ description: 'Login realizado com sucesso!' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        description: `Erro ao fazer login: ${message}`,
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  }

  if (showPasswordReset) {
    return (
      <PasswordResetForm
        onCancel={() => setShowPasswordReset(false)}
      />
    );
  }

  return (
    <AuthShell
      title="Acesse sua conta"
      description=""
    >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className="text-sm font-semibold text-slate-700">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="voce@empresa.com"
                      className={authInputClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className="text-sm font-semibold text-slate-700">Senha</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Digite sua senha"
                      className={authInputClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isAuthenticating}
              className={`w-full ${authPrimaryButtonClassName}`}
            >
              {isAuthenticating ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPasswordReset(true)}
                  className={authGhostButtonClassName}
                >
                  Esqueci minha senha
              </Button>
            </div>
          </form>
        </Form>
    </AuthShell>
  );
}
