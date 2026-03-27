'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useMutateAction } from '@uibakery/data';
import authenticateUserAction from '@/actions/authenticateUser';
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

import type { User } from '@/types/user';

interface LoginFormProps {
  onLogin: (user: User) => void;
}


export function LoginForm({ onLogin }: LoginFormProps) {
  const { toast } = useToast();
  const initialResetToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('reset_token')
      : null;
  const [resetToken, setResetToken] = useState<string | null>(initialResetToken);
  const [showPasswordReset, setShowPasswordReset] = useState(Boolean(initialResetToken));
  const [authenticateUser, isAuthenticating] = useMutateAction(authenticateUserAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: FormData) {
    try {
      const users = await authenticateUser({
        email: values.email,
        password: values.password,
      });

      if (users && users.length > 0) {
        const user = users[0];
        toast({ description: 'Login realizado com sucesso!' });
        onLogin(user);
      } else {
        toast({
          description: 'Email ou senha inválidos.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        description: `Erro ao fazer login: ${message}`,
        variant: 'destructive',
      });
    }
  }

  if (showPasswordReset) {
    const handleCancelReset = () => {
      if (typeof window !== 'undefined' && resetToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset_token');
        window.history.replaceState(window.history.state, '', url.toString());
      }
      setResetToken(null);
      setShowPasswordReset(false);
    };

    return (
      <PasswordResetForm
        token={resetToken ?? undefined}
        onCancel={handleCancelReset}
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
                  onClick={() => {
                    setResetToken(null);
                    setShowPasswordReset(true);
                  }}
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
