'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMutateAction } from '@uibakery/data';
import updateFornecedorAction from '@/actions/updateFornecedor';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: 'Email inválido.' }).optional().or(z.literal('')),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  einNumber: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Fornecedor {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  ein_number: string | null;
}

interface FornecedorEditDialogProps {
  fornecedor: Fornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FornecedorEditDialog({ fornecedor, open, onOpenChange, onSuccess }: FornecedorEditDialogProps) {
  const { toast } = useToast();
  const [updateFornecedor, isUpdating] = useMutateAction(updateFornecedorAction);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      contactName: '',
      contactPhone: '',
      einNumber: '',
    },
  });

  useEffect(() => {
    if (fornecedor && open) {
      form.reset({
        name: fornecedor.name || '',
        address: fornecedor.address || '',
        phone: fornecedor.phone || '',
        email: fornecedor.email || '',
        contactName: fornecedor.contact_name || '',
        contactPhone: fornecedor.contact_phone || '',
        einNumber: fornecedor.ein_number || '',
      });
    }
  }, [fornecedor, open, form]);

  async function onSubmit(values: FormData) {
    if (!fornecedor) return;

    try {
      await updateFornecedor({
        id: fornecedor.id,
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        contactName: values.contactName || null,
        contactPhone: values.contactPhone || null,
        einNumber: values.einNumber || null,
      });

      toast({ description: 'Fornecedor atualizado com sucesso!' });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        description: 'Erro ao atualizar fornecedor. Tente novamente.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Fornecedor</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="einNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EIN Number</FormLabel>
                    <FormControl>
                      <Input placeholder="12-3456789" {...field} />
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
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
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
                      <Input type="email" placeholder="contato@fornecedor.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone do Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Rua, número, bairro, cidade, estado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
