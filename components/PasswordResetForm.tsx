'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useMutateAction } from '@uibakery/data';
import generatePasswordResetTokenAction from '@/actions/generatePasswordResetToken';
import resetPasswordAction from '@/actions/resetPassword';
import { hashPassword } from '@/lib/crypto';
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

const resetSchema = z.object({
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem.',
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

interface PasswordResetFormProps {
  token?: string;
  onCancel?: () => void;
}

export function PasswordResetForm({ token, onCancel }: PasswordResetFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'email' | 'reset' | 'success'>(token ? 'reset' : 'email');
  const [emailSent, setEmailSent] = useState(false);

  const [generateToken, isGeneratingToken] = useMutateAction(generatePasswordResetTokenAction);
  const [resetPassword, isResettingPassword] = useMutateAction(resetPasswordAction);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmitEmail(values: EmailFormData) {
    try {
      // Gerar token único com entropia criptográfica
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const resetToken = btoa(String.fromCharCode(...tokenBytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]!));
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      const result = await generateToken({
        email: values.email,
        token: resetToken,
        expiresAt: expiresAt.toISOString(),
      });

      if (result && result.length > 0) {
        // TODO: enviar email com o link de reset em produção
        
        setEmailSent(true);
        toast({
          description: `Link de recuperação enviado para ${values.email}. Verifique o console para o token (ambiente de desenvolvimento).`,
        });
      } else {
        toast({
          description: 'Email não encontrado ou usuário inativo.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        description: 'Erro ao gerar token de recuperação. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  async function onSubmitReset(values: ResetFormData) {
    if (!token) return;

    try {
      const passwordHash = await hashPassword(values.password);
      
      const result = await resetPassword({
        token: token,
        newPasswordHash: passwordHash,
      });

      if (result && result.length > 0) {
        setStep('success');
        toast({
          description: 'Senha alterada com sucesso!',
        });
      } else {
        toast({
          description: 'Token inválido ou expirado.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        description: 'Erro ao alterar senha. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  if (step === 'success') {
    return (
      <AuthShell
        eyebrow="Recuperação concluída"
        title="Senha alterada com sucesso"
        description="Sua nova senha já está ativa. Você pode voltar ao login e acessar a plataforma normalmente."
      >
        <div className="space-y-4 text-center">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
            Sua senha foi atualizada com sucesso.
          </div>
          {onCancel && (
            <Button onClick={onCancel} className={`w-full ${authPrimaryButtonClassName}`}>
              Fazer Login
            </Button>
          )}
        </div>
      </AuthShell>
    );
  }

  if (step === 'reset') {
    return (
      <AuthShell
        eyebrow="Redefinir acesso"
        title="Crie uma nova senha"
        description="Escolha uma senha segura para concluir a recuperação e voltar ao sistema com tranquilidade."
      >
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onSubmitReset)} className="space-y-5">
              <FormField
                control={resetForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-semibold text-slate-700">Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="No minimo 6 caracteres" className={authInputClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resetForm.control}
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

              <div className="flex flex-col gap-3 sm:flex-row">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className={`flex-1 ${authSecondaryButtonClassName}`}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={isResettingPassword} className={`flex-1 ${authPrimaryButtonClassName}`}>
                  {isResettingPassword ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </div>
            </form>
          </Form>
      </AuthShell>
    );
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
                <Button type="submit" disabled={isGeneratingToken} className={`flex-1 ${authPrimaryButtonClassName}`}>
                  {isGeneratingToken ? 'Enviando...' : 'Enviar Link'}
                </Button>
              </div>
            </form>
          </Form>
        )}
    </AuthShell>
  );
}
