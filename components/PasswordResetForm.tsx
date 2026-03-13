'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutateAction } from '@uibakery/data';
import generatePasswordResetTokenAction from '@/actions/generatePasswordResetToken';
import resetPasswordAction from '@/actions/resetPassword';
import verifyPasswordResetTokenAction from '@/actions/verifyPasswordResetToken';
import { useToast } from '@/hooks/use-toast';

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
  const [verifyToken, isVerifyingToken] = useMutateAction(verifyPasswordResetTokenAction);

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
      // Gerar token único
      const resetToken = btoa(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      const result = await generateToken({
        email: values.email,
        token: resetToken,
        expiresAt: expiresAt.toISOString(),
      });

      if (result && result.length > 0) {
        // Em produção, aqui você enviaria um email
        console.log('Token de reset:', resetToken);
        console.log('Link de reset:', `${window.location.origin}/reset-password?token=${resetToken}`);
        
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
      const passwordHash = btoa(values.password); // Simplificado - use bcrypt em produção
      
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
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Senha Alterada!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p>Sua senha foi alterada com sucesso. Você já pode fazer login com a nova senha.</p>
          {onCancel && (
            <Button onClick={onCancel} className="w-full">
              Fazer Login
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'reset') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Nova Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onSubmitReset)} className="space-y-4">
              <FormField
                control={resetForm.control}
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
                control={resetForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={isResettingPassword} className="flex-1">
                  {isResettingPassword ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Esqueci Minha Senha</CardTitle>
      </CardHeader>
      <CardContent>
        {emailSent ? (
          <div className="text-center space-y-4">
            <p>Enviamos um link de recuperação para seu email. Verifique sua caixa de entrada.</p>
            <p className="text-sm text-gray-600">
              Não recebeu o email? Verifique sua pasta de spam ou tente novamente.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setEmailSent(false)}
              className="w-full"
            >
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={isGeneratingToken} className="flex-1">
                  {isGeneratingToken ? 'Enviando...' : 'Enviar Link'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
