'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface EstruturaDreItem {
  id?: number;
  tipo: 'GRUPO' | 'SUBGRUPO' | 'SOMA' | 'APORTE' | 'RETIRADA';
  nome: string;
  grupo_contabil_id?: number;
  subgrupo_contabil_id?: number;
  ordem: number;
  nivel: number;
  funcao?: 'CREDITO' | 'DEBITO';
}

interface SumLineGroupSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedGroups: number[], sumLineName: string) => void;
  availableGroups: EstruturaDreItem[];
}

export function SumLineGroupSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  availableGroups,
}: SumLineGroupSelectionModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [sumLineName, setSumLineName] = useState('');

  const handleGroupToggle = (itemIndex: number, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, itemIndex]);
    } else {
      setSelectedGroups(selectedGroups.filter(id => id !== itemIndex));
    }
  };

  const handleConfirm = () => {
    if (!sumLineName.trim()) {
      alert('Nome da linha de soma é obrigatório.');
      return;
    }
    
    if (selectedGroups.length === 0) {
      alert('Selecione pelo menos um item para a linha de soma.');
      return;
    }

    onConfirm(selectedGroups, sumLineName.trim());
    
    // Reset form
    setSelectedGroups([]);
    setSumLineName('');
    onClose();
  };

  const handleCancel = () => {
    setSelectedGroups([]);
    setSumLineName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Linha de Soma</DialogTitle>
          <DialogDescription>
            Defina o nome da linha de soma e selecione quais itens (grupos, aportes ou retiradas) farão parte do cálculo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Nome da Linha de Soma *</label>
            <input
              type="text"
              value={sumLineName}
              onChange={(e) => setSumLineName(e.target.value)}
              placeholder="Ex: Total de Receitas, Total de Despesas, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Itens Disponíveis para Soma</label>
            {availableGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhum item disponível. Adicione grupos, aportes ou retiradas primeiro.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-3">
                {availableGroups.map((group, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Checkbox
                      id={`group-${index}`}
                      checked={selectedGroups.includes(index)}
                      onCheckedChange={(checked) => handleGroupToggle(index, !!checked)}
                    />
                    <label
                      htmlFor={`group-${index}`}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          group.tipo === 'GRUPO' ? 'default' :
                          group.tipo === 'APORTE' ? 'default' :
                          group.tipo === 'RETIRADA' ? 'destructive' : 'default'
                        }>
                          {group.tipo}
                        </Badge>
                        <span className="font-medium">{group.nome}</span>
                        {(group.tipo === 'APORTE' || group.tipo === 'RETIRADA') && (
                          <Badge variant="outline" className="text-xs">
                            {group.tipo === 'APORTE' ? 'Crédito' : 'Débito'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Ordem: {group.ordem}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedGroups.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Itens Selecionados ({selectedGroups.length}):
              </h4>
              <div className="flex flex-wrap gap-1">
                {selectedGroups.map(index => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {availableGroups[index].nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!sumLineName.trim() || selectedGroups.length === 0}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
