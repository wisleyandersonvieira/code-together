'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import fixEmpresasSequenceAction from '@/actions/fixEmpresasSequence';
import checkEmpresasSequenceAction from '@/actions/checkEmpresasSequence';
import { useToast } from '@/hooks/use-toast';

export function SequenceHelper() {
  const { toast } = useToast();
  const [fixSequence, isFixing] = useMutateAction(fixEmpresasSequenceAction);
  const [sequenceStatus, loading, error, refresh] = useLoadAction(checkEmpresasSequenceAction, []);

  const handleFixSequence = async () => {
    try {
      await fixSequence();
      await refresh();
      toast({
        description: 'Sequência da tabela empresas corrigida com sucesso!',
      });
    } catch (error) {
      toast({
        description: 'Erro ao corrigir sequência. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const status = sequenceStatus[0];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Helper de Sequência - Empresas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Verificando status...</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Last Value:</span> {status?.last_value || 'N/A'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Is Called:</span> {status?.is_called ? 'Sim' : 'Não'}
            </p>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            Verificar Status
          </Button>
          
          <Button
            onClick={handleFixSequence}
            size="sm"
            disabled={isFixing}
          >
            {isFixing ? 'Corrigindo...' : 'Corrigir Sequência'}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Use esta ferramenta se houver erros de "id must be unique" ao criar empresas.
        </p>
      </CardContent>
    </Card>
  );
}
