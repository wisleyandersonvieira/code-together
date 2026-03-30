'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { supabase } from '@/src/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AuthShell,
  authInputClassName,
  authPrimaryButtonClassName,
} from './AuthShell';

const resetSchema = z.object({
  password: z.string().min(8, { message: 'Senha deve ter pelo menos 8 caracteres.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem.',
  path: ['confirmPassword'],
});

type ResetFormData = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const { toast } = useToast();
  const [isRecovery, setIsRecovery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    // Check URL hash for recovery token
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
      setChecking(false);
    } else {
      // If user has an active session on /reset-password, they likely came from a recovery link
      // (the PASSWORD_RECOVERY event may have already fired before this component mounted)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsRecovery(true);
        }
        setChecking(false);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: ResetFormData) {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        toast({
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setSuccess(true);
        toast({ description: 'Senha alterada com sucesso!' });
        // Redirect to home after a short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch {
      toast({
        description: 'Erro ao alterar senha. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f3f4f6_45%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
          <AuthShell
            eyebrow="Recuperação concluída"
            title="Senha alterada com sucesso"
            description="Sua nova senha já está ativa. Redirecionando..."
          >
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800 text-center">
              Sua senha foi atualizada com sucesso.
            </div>
          </AuthShell>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f3f4f6_45%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
          <div className="text-slate-500">Verificando link...</div>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f3f4f6_45%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
          <AuthShell
            eyebrow="Link inválido"
            title="Link expirado ou inválido"
            description="O link de recuperação de senha é inválido ou já expirou."
          >
            <Button
              onClick={() => { window.location.href = '/'; }}
              className={`w-full ${authPrimaryButtonClassName}`}
            >
              Voltar ao Login
            </Button>
          </AuthShell>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f8fafc_0%,#f3f4f6_45%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <AuthShell
          eyebrow="Redefinir acesso"
          title="Crie uma nova senha"
          description="Escolha uma senha segura para concluir a recuperação."
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-semibold text-slate-700">Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="No mínimo 8 caracteres" className={authInputClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-semibold text-slate-700">Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Repita a senha" className={authInputClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className={`w-full ${authPrimaryButtonClassName}`}>
                {isSubmitting ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </form>
          </Form>
        </AuthShell>
      </div>
    </div>
  );
}
