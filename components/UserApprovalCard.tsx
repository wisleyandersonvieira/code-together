'use client';

import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import approveUserAction from '@/actions/approveUser';

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  created_at: string;
}

interface UserApprovalCardProps {
  user: User;
  onApproved: () => void;
  onRejected: () => void;
}

export function UserApprovalCard({ user, onApproved, onRejected }: UserApprovalCardProps) {
  const { toast } = useToast();
  const [approveUser, isApproving] = useMutateAction(approveUserAction);
  const [selectedRole, setSelectedRole] = useState('user');

  const handleApprove = async () => {
    try {
      await approveUser({
        userId: user.id,
        role: selectedRole,
      });
      
      toast({
        description: 'Usuário aprovado com sucesso!',
      });
      
      onApproved();
    } catch (error) {
      toast({
        description: 'Erro ao aprovar usuário.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (confirm('Tem certeza que deseja rejeitar este usuário? Ele será removido do sistema.')) {
      onRejected();
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Aprovação Pendente
          </CardTitle>
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            Pendente
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Nome:</strong> {user.name}
            </div>
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            {user.phone && (
              <div>
                <strong>Telefone:</strong> {user.phone}
              </div>
            )}
            <div>
              <strong>Cadastrado em:</strong> {new Date(user.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar papel:</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleApprove} 
              disabled={isApproving}
              className="flex-1"
            >
              <Check className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
            <Button 
              variant="outline" 
              onClick={handleReject}
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Rejeitar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
