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
import authenticateUserAction from '@/actions/authenticateUser';
import updateLastLoginAction from '@/actions/updateLastLogin';
import { useToast } from '@/hooks/use-toast';
import { PasswordResetForm } from './PasswordResetForm';
import { ProvisonLogo } from './ProvisonLogo';

const formSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(1, { message: 'Senha é obrigatória.' }),
});

type FormData = z.infer<typeof formSchema>;

import type { User } from '@/types/user';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

const LOCAL_DEV_USER: User = {
  id: 1,
  name: 'Admin Test',
  email: 'admin@provison.com',
  role: 'admin',
  status: 'active',
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  password_hash: btoa('secret'),
};

function isLocalDevLogin(email: string, password: string) {
  return import.meta.env.DEV && email === LOCAL_DEV_USER.email && password === 'secret';
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const { toast } = useToast();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [authenticateUser, isAuthenticating] = useMutateAction(authenticateUserAction);
  const [updateLastLogin] = useMutateAction(updateLastLoginAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: FormData) {
    try {
      console.log('Tentando autenticar usuário:', values.email);
      
      const users = await authenticateUser({
        email: values.email,
      });

      console.log('Resultado da autenticação:', users);

      if (users && users.length > 0) {
        const user = users[0];
        
        console.log('Usuário encontrado:', { id: user.id, name: user.name, email: user.email, status: user.status });
        
        // Verificar senha (simplificado - use bcrypt em produção)
        const inputPasswordHash = btoa(values.password);
        
        if (user.password_hash && user.password_hash === inputPasswordHash) {
          // Atualizar último login
          await updateLastLogin({ userId: user.id });
          
          toast({
            description: 'Login realizado com sucesso!',
          });
          
          onLogin(user);
        } else if (!user.password_hash) {
          console.log('Usuário sem senha definida');
          toast({
            description: 'Usuário não possui senha cadastrada. Entre em contato com o administrador.',
            variant: 'destructive',
          });
        } else {
          console.log('Senha incorreta');
          toast({
            description: 'Senha incorreta.',
            variant: 'destructive',
          });
        }
      } else {
        console.log('Nenhum usuário encontrado ou usuário inativo');
        if (isLocalDevLogin(values.email, values.password)) {
          toast({
            description: 'Login local de desenvolvimento realizado com sucesso!',
          });
          onLogin(LOCAL_DEV_USER);
          return;
        }

        toast({
          description: 'Email não encontrado ou usuário inativo.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2));

      if (isLocalDevLogin(values.email, values.password)) {
        toast({
          description: 'Login local de desenvolvimento realizado com sucesso!',
        });
        onLogin(LOCAL_DEV_USER);
        return;
      }

      toast({
        description: `Erro ao fazer login: ${error?.message || JSON.stringify(error) || 'Erro desconhecido'}`,
        variant: 'destructive',
      });
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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-black p-4 rounded-lg">
            <ProvisonLogo className="w-16 h-16" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">PROVISON</h1>
            <CardTitle className="text-xl text-gray-600 mt-2">Sistema de Gestão</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isAuthenticating} className="w-full">
              {isAuthenticating ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="text-center">
              <Button 
                type="button" 
                variant="link" 
                onClick={() => setShowPasswordReset(true)}
                className="text-sm"
              >
                Esqueci minha senha
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
