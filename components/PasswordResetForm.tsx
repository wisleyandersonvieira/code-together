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
import {
  AuthShell,
  authGhostButtonClassName,
  authInputClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from './AuthShell';

const emailSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface PasswordResetFormProps {
  onCancel?: () => void;
}

export function PasswordResetForm({ onCancel }: PasswordResetFormProps) {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmitEmail(values: EmailFormData) {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          description: 'Erro ao enviar email de recuperação. Tente novamente.',
          variant: 'destructive',
        });
      } else {
        setEmailSent(true);
        toast({
          description: 'Se o email existir, um link de recuperação será enviado.',
        });
      }
    } catch {
      toast({
        description: 'Erro ao enviar email de recuperação. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recuperação de acesso"
      title="Esqueceu sua senha?"
      description="Informe seu email corporativo e enviaremos um link para redefinir seu acesso com segurança."
    >
        {emailSent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              Enviamos um link de recuperação para seu email. Verifique sua caixa de entrada.
            </div>
            <p className="text-sm leading-6 text-slate-500">
              Não recebeu o email? Verifique sua pasta de spam ou tente novamente.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => setEmailSent(false)}
                className={`w-full ${authSecondaryButtonClassName}`}
              >
                Tentar Novamente
              </Button>
              {onCancel ? (
                <Button type="button" variant="ghost" onClick={onCancel} className={authGhostButtonClassName}>
                  Voltar ao login
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-5">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-semibold text-slate-700">Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="voce@empresa.com" className={authInputClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className={`flex-1 ${authSecondaryButtonClassName}`}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting} className={`flex-1 ${authPrimaryButtonClassName}`}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Link'}
                </Button>
              </div>
            </form>
          </Form>
        )}
    </AuthShell>
  );
}
