'use client';

import React, { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, X, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import loadGruposContabeisAction from '@/actions/loadGruposContabeis';
import loadAllSubgruposContabeisAction from '@/actions/loadAllSubgruposContabeis';
import createEstruturaDreAction from '@/actions/createEstruturaDre';
import loadEstruturaDreItensAction from '@/actions/loadEstruturaDreItens';
import createEstruturaDreItemAction from '@/actions/createEstruturaDreItem';
import updateEstruturaDreItemAction from '@/actions/updateEstruturaDreItem';
import deleteEstruturaDreItemAction from '@/actions/deleteEstruturaDreItem';
import createEstruturaDreSomaItemAction from '@/actions/createEstruturaDreSomaItem';

interface EstruturaDreItem {
  id?: number;
  tipo: 'GRUPO' | 'SUBGRUPO' | 'SOMA' | 'APORTE' | 'RETIRADA';
  nome: string;
  grupo_contabil_id?: number;
  subgrupo_contabil_id?: number;
  ordem: number;
  nivel: number;
  parent_id?: number;
  grupo_nome?: string;
  subgrupo_nome?: string;
  subgrupo_funcao?: string;
  soma_referencias?: number[];
  funcao?: 'CREDITO' | 'DEBITO'; // Fixed function for APORTE/RETIRADA
}

interface EstruturaDreFormProps {
  estrutura?: { id: number; nome: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export function EstruturaDreForm({ estrutura, onSuccess, onCancel }: EstruturaDreFormProps) {
  const { toast } = useToast();
  const [nomeEstrutura, setNomeEstrutura] = useState(estrutura?.nome || '');
  const [itens, setItens] = useState<EstruturaDreItem[]>([]);
  const [nextOrder, setNextOrder] = useState(1);


  // Load data
  const [gruposContabeis] = useLoadAction(loadGruposContabeisAction, []);
  const [allSubgrupos] = useLoadAction(loadAllSubgruposContabeisAction, []);


  
  // Load existing items if editing
  const [existingItens, , , refreshItens] = useLoadAction(
    loadEstruturaDreItensAction,
    [],
    { estruturaId: estrutura?.id || null },
    !!estrutura?.id
  );

  // Actions
  const [createEstrutura, isCreatingEstrutura] = useMutateAction(createEstruturaDreAction);
  const [createItem, isCreatingItem] = useMutateAction(createEstruturaDreItemAction);
  const [updateItemAction, isUpdatingItem] = useMutateAction(updateEstruturaDreItemAction);
  const [deleteItem, isDeletingItem] = useMutateAction(deleteEstruturaDreItemAction);
  const [createSomaItem] = useMutateAction(createEstruturaDreSomaItemAction);

  useEffect(() => {
    if (existingItens && existingItens.length > 0) {
      setItens(existingItens);
      const maxOrder = Math.max(...existingItens.map((item: EstruturaDreItem) => item.ordem));
      setNextOrder(Math.floor(maxOrder) + 1);
    }
  }, [existingItens]);

  const generateOrder = (tipo: string, parentOrder?: number): number => {
    if (tipo === 'GRUPO') {
      return nextOrder;
    }
    
    if (tipo === 'SUBGRUPO' && parentOrder) {
      const subgroupsInParent = itens.filter(
        item => item.tipo === 'SUBGRUPO' && Math.floor(item.ordem) === Math.floor(parentOrder)
      );
      return parentOrder + (subgroupsInParent.length + 1) / 10;
    }
    
    return nextOrder + 0.5;
  };

  const addGrupo = () => {
    const ordem = generateOrder('GRUPO');
    const novoItem: EstruturaDreItem = {
      tipo: 'GRUPO',
      nome: '',
      ordem,
      nivel: 1,
    };
    setItens([...itens, novoItem]);
    setNextOrder(nextOrder + 1);
  };

  const addSubgrupo = () => {
    // Find the most recent GROUP (highest order number among groups)
    const groups = itens.filter(item => item.tipo === 'GRUPO');
    
    if (groups.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione um grupo primeiro antes de adicionar um subgrupo.',
        variant: 'destructive',
      });
      return;
    }

    // Get the group with highest order (most recently added)
    const mostRecentGroup = groups.reduce((max, current) => 
      current.ordem > max.ordem ? current : max
    );

    const ordem = generateOrder('SUBGRUPO', mostRecentGroup.ordem);
    const novoItem: EstruturaDreItem = {
      tipo: 'SUBGRUPO',
      nome: '',
      grupo_contabil_id: mostRecentGroup.grupo_contabil_id, // Pre-select the group from most recent group
      ordem,
      nivel: 2,
      parent_id: mostRecentGroup.id,
    };
    setItens([...itens, novoItem]);
  };

  const addSubgrupoToGroup = (groupOrderIndex: number) => {
    const groupItem = itens.find(item => item.tipo === 'GRUPO' && item.ordem === groupOrderIndex);
    if (!groupItem) return;

    if (!groupItem.grupo_contabil_id) {
      toast({
        title: 'Erro',
        description: 'Selecione um grupo contábil para o grupo primeiro.',
        variant: 'destructive',
      });
      return;
    }

    const ordem = generateOrder('SUBGRUPO', groupItem.ordem);
    const novoItem: EstruturaDreItem = {
      tipo: 'SUBGRUPO',
      nome: '',
      grupo_contabil_id: groupItem.grupo_contabil_id,
      ordem,
      nivel: 2,
      parent_id: groupItem.id, // This will be null for new items but properly set during save
    };
    setItens([...itens, novoItem]);
  };

  const addAporte = () => {
    const ordem = generateOrder('GRUPO');
    const novoItem: EstruturaDreItem = {
      tipo: 'APORTE',
      nome: 'APORTE',
      ordem,
      nivel: 1,
      funcao: 'CREDITO',
    };
    setItens([...itens, novoItem]);
    setNextOrder(nextOrder + 1);
  };

  const addRetirada = () => {
    const ordem = generateOrder('GRUPO');
    const novoItem: EstruturaDreItem = {
      tipo: 'RETIRADA',
      nome: 'RETIRADA',
      ordem,
      nivel: 1,
      funcao: 'DEBITO',
    };
    setItens([...itens, novoItem]);
    setNextOrder(nextOrder + 1);
  };

  const addLinhaSoma = () => {
    // Check if there are items available to sum
    const availableItems = itens.filter(item => 
      (item.tipo === 'GRUPO' || item.tipo === 'SUBGRUPO' || item.tipo === 'APORTE' || item.tipo === 'RETIRADA') && 
      item.nome.trim()
    );
    
    if (availableItems.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos um item antes de criar uma linha de soma.',
        variant: 'destructive',
      });
      return;
    }

    // Create line name prompt
    const sumLineName = prompt('Digite o nome para a linha de soma:');
    if (!sumLineName || !sumLineName.trim()) {
      return;
    }

    const ordem = generateOrder('SOMA');
    const novoItem: EstruturaDreItem = {
      tipo: 'SOMA',
      nome: sumLineName.trim(),
      ordem,
      nivel: 1,
    };
    setItens([...itens, novoItem]);
    setNextOrder(nextOrder + 1);
  };



  const updateItem = (index: number, field: string, value: any) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    
    // Update name based on selection
    if (field === 'grupo_contabil_id') {
      const grupo = gruposContabeis?.find((g: any) => g.id === value);
      if (grupo) {
        newItens[index].nome = grupo.descricao;
      }
    } else if (field === 'subgrupo_contabil_id') {
      const subgrupo = allSubgrupos?.find((s: any) => s.id === value);
      
      if (subgrupo) {
        newItens[index].nome = subgrupo.descricao;
        newItens[index].subgrupo_funcao = subgrupo.funcao;
      }
    }
    
    setItens(newItens);
  };

  const removeItem = async (index: number) => {
    const item = itens[index];
    
    if (item.id && estrutura?.id) {
      try {
        await deleteItem({ id: item.id });
        toast({
          title: 'Sucesso',
          description: 'Item removido com sucesso.',
        });
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Erro ao remover item.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    const newItens = itens.filter((_, i) => i !== index);
    setItens(newItens);
  };

  const handleSave = async () => {
    if (!nomeEstrutura.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da estrutura é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    // Validate all items have required data
    const invalidItems = itens.filter(item => {
      if (!item.nome || !item.nome.trim()) {
        return true; // Empty name
      }
      if (item.tipo === 'GRUPO' && !item.grupo_contabil_id) {
        return true; // Group without accounting group
      }
      if (item.tipo === 'SUBGRUPO' && (!item.grupo_contabil_id || !item.subgrupo_contabil_id)) {
        return true; // Subgroup without proper selections
      }
      return false;
    });



    if (invalidItems.length > 0) {
      toast({
        title: 'Erro de Validação',
        description: 'Todos os itens devem ter nome e seleções obrigatórias preenchidas.',
        variant: 'destructive',
      });
      return;
    }

    let estruturaId = estrutura?.id;

    try {
      // Create structure if new
      if (!estruturaId) {
        const result = await createEstrutura({ nome: nomeEstrutura });
        estruturaId = result[0]?.id;
        
        if (!estruturaId) {
          throw new Error('Erro ao criar estrutura DRE');
        }
      }

      // First pass: Save/Update groups and standalone items (APORTE, RETIRADA, SOMA)
      const createdItems = new Map<number, number>(); // originalIndex -> newId
      
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        if (item.tipo === 'GRUPO' || item.tipo === 'APORTE' || item.tipo === 'RETIRADA' || item.tipo === 'SOMA') {
          try {
            if (item.id) {
              // Update existing item
              await updateItemAction({
                id: item.id,
                tipo: item.tipo,
                nome: item.nome.trim(),
                grupoContabilId: item.grupo_contabil_id || null,
                subgrupoContabilId: item.subgrupo_contabil_id || null,
                ordem: item.ordem,
                nivel: item.nivel,
                parentId: null,
              });
              createdItems.set(i, item.id);
            } else {
              // Create new item
              const result = await createItem({
                estruturaId,
                tipo: item.tipo,
                nome: item.nome.trim(),
                grupoContabilId: item.grupo_contabil_id || null,
                subgrupoContabilId: item.subgrupo_contabil_id || null,
                ordem: item.ordem,
                nivel: item.nivel,
                parentId: null,
              });
              
              if (result && result.length > 0) {
                createdItems.set(i, result[0].id);
              }
            }
          } catch (error) {
            console.error('Error saving item:', item, error);
            throw new Error(`Erro ao salvar item: ${item.nome}`);
          }
        }
      }

      // Second pass: Save/Update subgroups with proper parent_id
      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        if (item.tipo === 'SUBGRUPO') {
          // Find parent group
          let parentId = null;
          if (item.grupo_contabil_id) {
            // Look for parent group with same grupo_contabil_id
            for (let j = 0; j < itens.length; j++) {
              const potentialParent = itens[j];
              if (potentialParent.tipo === 'GRUPO' && 
                  potentialParent.grupo_contabil_id === item.grupo_contabil_id &&
                  createdItems.has(j)) {
                parentId = createdItems.get(j);
                break;
              }
            }
          }
          
          try {
            if (item.id) {
              // Update existing subgroup
              await updateItemAction({
                id: item.id,
                tipo: item.tipo,
                nome: item.nome.trim(),
                grupoContabilId: item.grupo_contabil_id || null,
                subgrupoContabilId: item.subgrupo_contabil_id || null,
                ordem: item.ordem,
                nivel: item.nivel,
                parentId,
              });
            } else {
              // Create new subgroup
              const result = await createItem({
                estruturaId,
                tipo: item.tipo,
                nome: item.nome.trim(),
                grupoContabilId: item.grupo_contabil_id || null,
                subgrupoContabilId: item.subgrupo_contabil_id || null,
                ordem: item.ordem,
                nivel: item.nivel,
                parentId,
              });
              
              if (result && result.length > 0) {
                createdItems.set(i, result[0].id);
              }
            }
          } catch (error) {
            console.error('Error saving subgroup:', item, error);
            throw new Error(`Erro ao salvar subgrupo: ${item.nome}`);
          }
        }
      }

      // SOMA lines no longer need manual references - they auto-sum items above them

      toast({
        title: 'Sucesso',
        description: `Estrutura DRE ${estrutura ? 'atualizada' : 'criada'} com sucesso.`,
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Erro ao Salvar',
        description: error.message || `Erro ao ${estrutura ? 'atualizar' : 'criar'} estrutura DRE.`,
        variant: 'destructive',
      });
    }
  };

  const getAvailableSubgrupos = (grupoId: number) => {
    return allSubgrupos?.filter((sg: any) => sg.grupo_id === grupoId) || [];
  };

  const getItemTypeBadge = (tipo: string) => {
    const variants = {
      GRUPO: 'default',
      SUBGRUPO: 'secondary',
      SOMA: 'outline',
      APORTE: 'default',
      RETIRADA: 'destructive',
    } as const;

    return (
      <Badge variant={variants[tipo as keyof typeof variants] || 'default'}>
        {tipo}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {estrutura ? 'Editar Estrutura DRE' : 'Nova Estrutura DRE'}
          </h2>
          <p className="text-muted-foreground">
            Configure a estrutura do Demonstrativo de Resultado do Exercício
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isCreatingEstrutura || isCreatingItem || isUpdatingItem}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Estrutura</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome da Estrutura *</label>
              <Input
                value={nomeEstrutura}
                onChange={(e) => setNomeEstrutura(e.target.value)}
                placeholder="Digite o nome da estrutura DRE"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens da Estrutura</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={addGrupo} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Grupo
            </Button>
            <Button onClick={addSubgrupo} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Subgrupo
            </Button>
            <Button onClick={addAporte} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Aporte
            </Button>
            <Button onClick={addRetirada} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Retirada
            </Button>
            <Button onClick={addLinhaSoma} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Linha Soma
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {itens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum item adicionado. Use os botões acima para adicionar grupos, subgrupos ou linhas de soma.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Grupo/Subgrupo</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{getItemTypeBadge(item.tipo)}</TableCell>
                        <TableCell>
                          {item.tipo === 'SOMA' ? (
                            <Input
                              value={item.nome}
                              onChange={(e) => updateItem(index, 'nome', e.target.value)}
                              placeholder="Nome da linha de soma"
                            />
                          ) : (
                            <span className="font-medium">{item.nome}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.tipo === 'GRUPO' && (
                            <Select
                              value={item.grupo_contabil_id?.toString() || ''}
                              onValueChange={(value) =>
                                updateItem(index, 'grupo_contabil_id', parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o grupo" />
                              </SelectTrigger>
                              <SelectContent>
                                {gruposContabeis?.map((grupo: any) => (
                                  <SelectItem key={grupo.id} value={grupo.id.toString()}>
                                    {grupo.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {item.tipo === 'SUBGRUPO' && (
                            <div className="space-y-2">
                              <div className="text-sm text-muted-foreground">
                                Grupo: {item.grupo_nome || gruposContabeis?.find((g: any) => g.id === item.grupo_contabil_id)?.descricao || 'Não definido'}
                              </div>
                              <Select
                                value={item.subgrupo_contabil_id?.toString() || ''}
                                onValueChange={(value) =>
                                  updateItem(index, 'subgrupo_contabil_id', parseInt(value))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o subgrupo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {item.grupo_contabil_id && getAvailableSubgrupos(item.grupo_contabil_id).map((subgrupo: any) => (
                                    <SelectItem key={subgrupo.id} value={subgrupo.id.toString()}>
                                      {subgrupo.descricao}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {(item.tipo === 'SOMA' || item.tipo === 'APORTE' || item.tipo === 'RETIRADA') && '-'}
                        </TableCell>
                        <TableCell>
                          {item.tipo === 'SUBGRUPO' && (
                            (() => {
                              // Priority order: 1) Database join result 2) Direct subgrupo lookup
                              const funcao = item.subgrupo_funcao || 
                                            allSubgrupos?.find((s: any) => s.id === item.subgrupo_contabil_id)?.funcao;
                              
                              // Simple debug logging only if needed for troubleshooting
                              if ((item.nome === 'Taxa Adm' || item.nome?.includes('Taxa') || item.nome?.includes('Adm')) && process.env.NODE_ENV === 'development') {
                                console.log('Function display for', item.nome, ':', funcao);
                              }
                              
                              if (funcao) {
                                // Clean and normalize the function value
                                const normalizedFunction = String(funcao).toUpperCase().trim();
                                // Remove accents for comparison - handle both "CRÉDITO" and "CREDITO"
                                const normalizedForComparison = normalizedFunction.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                const isCredito = normalizedForComparison === 'CREDITO' || normalizedFunction === 'CREDITO';
                                
                                // Additional debug for Taxa Adm
                                if (item.nome === 'Taxa Adm' || item.nome?.includes('Taxa') || item.nome?.includes('Adm')) {
                                  console.log('BADGE RENDERING - isCredito:', isCredito, 'normalized:', normalizedFunction, 'no-accent:', normalizedForComparison);
                                }
                                
                                return (
                                  <Badge variant={isCredito ? 'default' : 'secondary'}>
                                    {isCredito ? 'Crédito' : 'Débito'}
                                  </Badge>
                                );
                              }
                              return <span className="text-muted-foreground">-</span>;
                            })()
                          )}
                          {item.tipo === 'APORTE' && (
                            <Badge variant="default">Crédito</Badge>
                          )}
                          {item.tipo === 'RETIRADA' && (
                            <Badge variant="secondary">Débito</Badge>
                          )}
                          {item.tipo === 'SOMA' && (
                            <Badge variant="outline">Soma</Badge>
                          )}
                          {item.tipo === 'GRUPO' && '-'}
                        </TableCell>
                        <TableCell>{item.ordem}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.tipo === 'GRUPO' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addSubgrupoToGroup(item.ordem)}
                                title="Adicionar subgrupo a este grupo"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              disabled={isDeletingItem}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
