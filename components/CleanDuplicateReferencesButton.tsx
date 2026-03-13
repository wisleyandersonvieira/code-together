'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutateAction } from '@uibakery/data';
import cleanDuplicateSomaReferencesAction from '@/actions/cleanDuplicateSomaReferences';

export function CleanDuplicateReferencesButton() {
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [cleanDuplicates] = useMutateAction(cleanDuplicateSomaReferencesAction);

  const handleCleanDuplicates = async () => {
    setIsClearing(true);

    try {
      const result = await cleanDuplicates({});
      console.log('Referências limpas:', result);
      
      toast({
        title: 'Sucesso',
        description: 'Referências SOMA duplicadas foram removidas.',
      });

    } catch (error: any) {
      console.error('Erro ao limpar duplicatas:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao limpar as referências duplicadas.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Button 
      onClick={handleCleanDuplicates} 
      disabled={isClearing}
      variant="outline"
      size="sm"
    >
      <Trash2 className={`mr-2 h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
      Limpar Duplicatas SOMA
    </Button>
  );
}
