'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UpdateSomaItem {
  id: number;
  tipo: string;
  nome: string;
  valor: number;
  ordem: number;
  /** Valor por matriz — chave é o id da matriz. */
  valores?: Record<number, number>;
}

interface UpdateSomaButtonProps {
  dreData: UpdateSomaItem[];
  onSomaUpdated: (updatedData: any[]) => void;
  estruturaItens: any[];
  /** Matrizes que compõem as colunas; cada uma recalcula sua SOMA. */
  matrizIds?: number[];
}

export function UpdateSomaButton({ dreData, onSomaUpdated, estruturaItens, matrizIds }: UpdateSomaButtonProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateSoma = async () => {
    setIsUpdating(true);

    try {

      // Sort by order for correct calculation
      const sortedData = [...dreData].sort((a, b) => a.ordem - b.ordem);

      // Colunas a recalcular: uma por matriz quando o DRE é multi-matriz.
      const colunas = matrizIds ?? [];

      // Recalcular apenas os itens SOMA
      const updatedData = sortedData.map((item, index) => {
        if (item.tipo === 'SOMA') {

          // Sum only SUBGRUPOS, APORTES e RETIRADAS above this SOMA line (exclude GRUPOS to avoid duplication)
          const itemsAbove = sortedData.slice(0, index).filter(aboveItem => 
            aboveItem.tipo === 'SUBGRUPO' || 
            aboveItem.tipo === 'APORTE' || 
            aboveItem.tipo === 'RETIRADA'
          );

          // Cada coluna de matriz soma independentemente; o total é a soma
          // horizontal das colunas, mantendo TOTAL coerente com as parcelas.
          const valores: Record<number, number> = {};
          colunas.forEach((matrizId) => {
            valores[matrizId] = itemsAbove.reduce(
              (sum: number, aboveItem) => sum + (aboveItem.valores?.[matrizId] ?? 0),
              0,
            );
          });

          const somaValue = colunas.length
            ? colunas.reduce((sum, matrizId) => sum + valores[matrizId], 0)
            : itemsAbove.reduce((sum: number, aboveItem) => sum + aboveItem.valor, 0);

          return colunas.length
            ? { ...item, valores, valor: somaValue }
            : { ...item, valor: somaValue };
        }
        return item;
      });

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
