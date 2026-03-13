'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, MapPin, User, Hash } from 'lucide-react';

interface Fornecedor {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  ein_number: string | null;
  created_at: string;
  updated_at: string;
}

interface FornecedorViewDialogProps {
  fornecedor: Fornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FornecedorViewDialog({ fornecedor, open, onOpenChange }: FornecedorViewDialogProps) {
  if (!fornecedor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Detalhes do Fornecedor</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg text-primary">{fornecedor.name}</h3>
                    <Badge variant="outline">ID: {fornecedor.id}</Badge>
                  </div>
                  
                  {fornecedor.ein_number && (
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">EIN: {fornecedor.ein_number}</span>
                    </div>
                  )}
                  
                  {fornecedor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{fornecedor.email}</span>
                    </div>
                  )}
                  
                  {fornecedor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{fornecedor.phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {fornecedor.contact_name && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Contato</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{fornecedor.contact_name}</span>
                      </div>
                    </div>
                  )}
                  
                  {fornecedor.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{fornecedor.contact_phone}</span>
                    </div>
                  )}
                  
                  {fornecedor.address && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Endereço</h4>
                      <div className="flex items-start gap-2 mt-1">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <span className="text-sm">{fornecedor.address}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Criado em: {new Date(fornecedor.created_at).toLocaleString('pt-BR')}</div>
            <div>Atualizado em: {new Date(fornecedor.updated_at).toLocaleString('pt-BR')}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
