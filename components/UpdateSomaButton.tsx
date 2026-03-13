'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UpdateSomaButtonProps {
  dreData: Array<{
    id: number;
    tipo: string;
    nome: string;
    valor: number;
    ordem: number;
  }>;
  onSomaUpdated: (updatedData: any[]) => void;
  estruturaItens: any[];
}

export function UpdateSomaButton({ dreData, onSomaUpdated, estruturaItens }: UpdateSomaButtonProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateSoma = async () => {
    setIsUpdating(true);

    try {
      console.log('Iniciando recálculo das SOMs...');
      console.log('DRE Data:', dreData);
      console.log('Estrutura Itens:', estruturaItens);

      // Criar um mapa dos valores calculados por ID
      const valueMap = new Map<number, number>();
      dreData.forEach(item => {
        valueMap.set(item.id, item.valor);
      });

      console.log('Mapa de valores:', valueMap);

      // Sort by order for correct calculation
      const sortedData = [...dreData].sort((a, b) => a.ordem - b.ordem);

      // Recalcular apenas os itens SOMA
      const updatedData = sortedData.map((item, index) => {
        if (item.tipo === 'SOMA') {
          console.log(`Recalculando SOMA ${item.nome} (ordem: ${item.ordem})`);

          // Sum only SUBGRUPOS, APORTES e RETIRADAS above this SOMA line (exclude GRUPOS to avoid duplication)
          const itemsAbove = sortedData.slice(0, index).filter(aboveItem => 
            aboveItem.tipo === 'SUBGRUPO' || 
            aboveItem.tipo === 'APORTE' || 
            aboveItem.tipo === 'RETIRADA'
          );
          
          const somaValue = itemsAbove.reduce((sum: number, aboveItem) => {
            console.log(`SOMA ${item.nome} - somando item ${aboveItem.nome} (${aboveItem.tipo}): ${aboveItem.valor}`);
            return sum + aboveItem.valor;
          }, 0);

          console.log(`SOMA ${item.nome} - valor final: ${somaValue}`);
          return { ...item, valor: somaValue };
        }
        return item;
      });

      console.log('Dados atualizados:', updatedData);
      onSomaUpdated(updatedData);
      
      toast({
        title: 'Sucesso',
        description: 'Valores das linhas SOMA foram recalculados.',
      });

    } catch (error: any) {
      console.error('Erro ao atualizar SOMs:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao recalcular as linhas SOMA.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Button 
      onClick={handleUpdateSoma} 
      disabled={isUpdating}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
      ATUALIZAR SOMA
    </Button>
  );
}
