'use client';

import React, { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import configureSomaReferencesAction from '@/actions/configureSomaReferences';

export function FixSomaReferences() {
  const { toast } = useToast();
  const [estruturaId, setEstruturaId] = useState<string>('9');
  const [configure, isConfiguring] = useMutateAction(configureSomaReferencesAction);

  const handleConfigure = async () => {
    if (!estruturaId) return;

    try {
      await configure({ estruturaId: parseInt(estruturaId) });
      
      toast({
        title: 'Sucesso',
        description: 'Referências das linhas SOMA foram configuradas automaticamente.',
      });
    } catch (error: any) {
      console.error('Erro ao configurar referências:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao configurar as referências das linhas SOMA.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrigir Referências das Linhas SOMA</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">ID da Estrutura DRE</label>
            <Input
              value={estruturaId}
              onChange={(e) => setEstruturaId(e.target.value)}
              placeholder="ID da estrutura"
              type="number"
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>Esta ação irá configurar automaticamente:</p>
            <ul className="list-disc ml-5 mt-2">
              <li><strong>Lucro:</strong> Soma de todos os grupos e aportes</li>
              <li><strong>Saldo:</strong> Lucro menos retiradas</li>
            </ul>
          </div>

          <Button 
            onClick={handleConfigure}
            disabled={isConfiguring || !estruturaId}
          >
            {isConfiguring ? 'Configurando...' : 'Configurar Referências'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
