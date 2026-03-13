'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileManager } from './FileManager';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, FileImage, FileText, Calculator, DollarSign, TrendingUp } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import createProjetoAction from '@/actions/createProjeto';
import updateProjetoAction from '@/actions/updateProjeto';
import createProjetoMemberAction from '@/actions/createProjetoMember';
import deleteProjetoMembersAction from '@/actions/deleteProjetoMembers';
import createOrcamentoAction from '@/actions/createOrcamento';
import deleteOrcamentosAction from '@/actions/deleteOrcamentos';
import loadOrcamentosComAlocacoesAction from '@/actions/loadOrcamentosComAlocacoes';
import deleteOrcamentoSemAlocacaoAction from '@/actions/deleteOrcamentoSemAlocacao';
import updateOrcamentoAction from '@/actions/updateOrcamento';
import loadClientesAction from '@/actions/loadClientes';
import loadEmpresasAction from '@/actions/loadEmpresas';
import loadGruposAction from '@/actions/loadGrupos';
import loadFornecedoresAction from '@/actions/loadFornecedores';
import { useToast } from '@/hooks/use-toast';
import { PrevisaoAportesManager } from './PrevisaoAportesManager';
import { ProjetoEvolucao } from './ProjetoEvolucao';
import { PrevisaoAportesEditModal } from './PrevisaoAportesEditModal';
import checkPrevisaoAportesExistsAction from '@/actions/checkPrevisaoAportesExists';

const memberSchema = z.object({
  type: z.enum(['cliente', 'empresa', 'grupo'], { message: 'Selecione o tipo' }),
  id: z.string().min(1, 'Selecione um cliente, empresa ou grupo'),
  percentage: z.number().min(0.01, 'Porcentagem deve ser maior que 0').max(100, 'Porcentagem não pode ser maior que 100'),
});

const orcamentoSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  fornecedorId: z.string().optional(),
  predictedDate: z.date().optional(),
  value: z.number().min(0.01, 'Valor deve ser maior que 0'),
});

const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres.' }),
  address: z.string().optional(),
  city: z.string().optional(),
  constructionSqft: z.number().min(0, 'Metragem deve ser positiva').optional(),
  landSqft: z.number().min(0, 'Metragem deve ser positiva').optional(),
  details: z.string().optional(),
  predictedSaleValue: z.number().min(0, 'Valor deve ser positivo').optional(),
  status: z.enum(['Em andamento', 'Concluído'], { required_error: 'Selecione o status do projeto' }),
  members: z.array(memberSchema).min(1, 'Adicione pelo menos um membro ao projeto'),
  orcamentos: z.array(orcamentoSchema).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Projeto {
  id?: number;
  name: string;
  address?: string;
  city?: string;
  construction_sqft?: number;
  land_sqft?: number;
  details?: string;
  predicted_sale_value?: number;
  status?: string;
  photo_urls?: string[];
  document_urls?: string[];
  members?: Array<{
    cliente_id?: number;
    empresa_id?: number;
    grupo_id?: number;
    cliente_name?: string;
    empresa_name?: string;
    grupo_name?: string;
    percentage: number;
  }>;
  orcamentos?: Array<{
    id?: number;
    description: string;
    fornecedor_id?: number;
    fornecedor_name?: string;
    predicted_date?: string;
    value: number;
  }>;
}

interface ProjetoFormProps {
  projeto?: Projeto;
  onSuccess: () => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export function ProjetoForm({ projeto, onSuccess, onCancel, readOnly = false }: ProjetoFormProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [createProjeto, isCreating] = useMutateAction(createProjetoAction);
  const [updateProjeto, isUpdating] = useMutateAction(updateProjetoAction);
  const [createProjetoMember] = useMutateAction(createProjetoMemberAction);
  const [deleteProjetoMembers] = useMutateAction(deleteProjetoMembersAction);
  const [createOrcamento] = useMutateAction(createOrcamentoAction);
  const [deleteOrcamentos] = useMutateAction(deleteOrcamentosAction);
  const [deleteOrcamentoSemAlocacao] = useMutateAction(deleteOrcamentoSemAlocacaoAction);
  const [updateOrcamento] = useMutateAction(updateOrcamentoAction);
  const [clientes, loadingClientes, errorClientes] = useLoadAction(loadClientesAction, [], { searchTerm: null });

  // Debug log para verificar o carregamento dos clientes
  React.useEffect(() => {
    console.log('Debug ProjetoForm - Clientes:', { clientes, loadingClientes, errorClientes });
  }, [clientes, loadingClientes, errorClientes]);
  
  // Load existing orcamentos with allocation info when editing
  const [orcamentosExistentes] = useLoadAction(
    loadOrcamentosComAlocacoesAction, 
    [], 
    { projetoId: projeto?.id || null }
  );
  const [empresas, loadingEmpresas, errorEmpresas] = useLoadAction(loadEmpresasAction, [], { clienteId: null, searchTerm: null });
  const [grupos, loadingGrupos, errorGrupos] = useLoadAction(loadGruposAction, []);
  
  // Debug logs para verificar carregamento
  React.useEffect(() => {
    console.log('Debug ProjetoForm - Empresas:', { empresas, loadingEmpresas, errorEmpresas });
    console.log('Debug ProjetoForm - Grupos:', { grupos, loadingGrupos, errorGrupos });
  }, [empresas, loadingEmpresas, errorEmpresas, grupos, loadingGrupos, errorGrupos]);
  const [fornecedores] = useLoadAction(loadFornecedoresAction, [], { searchTerm: null });
  const [savedProjetoId, setSavedProjetoId] = useState<number | null>(null);
  const [showPrevisaoAportes, setShowPrevisaoAportes] = useState(false);
  const [showPrevisaoModal, setShowPrevisaoModal] = useState(false);
  const [isNewProjectSaved, setIsNewProjectSaved] = useState(false);
  const [showPrevisaoAportesEdit, setShowPrevisaoAportesEdit] = useState(false);

  // Check if existing project has previsão de aportes
  const [previsaoExists] = useLoadAction(
    checkPrevisaoAportesExistsAction,
    [{ total_aportes: 0 }],
    { projetoId: projeto?.id || null }
  );
  const hasExistingPrevisao = previsaoExists[0]?.total_aportes > 0;

  // Set saved projeto ID when editing
  React.useEffect(() => {
    if (projeto?.id) {
      setSavedProjetoId(projeto.id);
    }
  }, [projeto?.id]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: projeto?.name || '',
      address: projeto?.address || '',
      city: projeto?.city || '',
      constructionSqft: projeto?.construction_sqft || 0,
      landSqft: projeto?.land_sqft || 0,
      details: projeto?.details || '',
      predictedSaleValue: projeto?.predicted_sale_value || 0,
      status: (projeto?.status as 'Em andamento' | 'Concluído') || 'Em andamento',
      members: projeto?.members?.map(m => ({
        type: m.cliente_id ? 'cliente' as const : m.empresa_id ? 'empresa' as const : 'grupo' as const,
        id: (m.cliente_id || m.empresa_id || m.grupo_id)?.toString() || '',
        percentage: m.percentage,
      })) || [{ type: 'cliente' as const, id: '', percentage: 0 }],
      orcamentos: projeto?.orcamentos?.map(o => ({
        description: o.description,
        fornecedorId: o.fornecedor_id?.toString() || '',
        predictedDate: o.predicted_date ? new Date(o.predicted_date) : undefined,
        value: o.value,
      })) || [],
    },
  });

  const { fields: memberFields, append: appendMember, remove: removeMember } = useFieldArray({
    control: form.control,
    name: 'members',
  });

  const { fields: orcamentoFields, append: appendOrcamento, remove: removeOrcamento } = useFieldArray({
    control: form.control,
    name: 'orcamentos',
  });

  const isSubmitting = isCreating || isUpdating;
  const [isPrevisaoSaved, setIsPrevisaoSaved] = useState(false);

  // Calculate total percentage for members
  const watchedMembers = form.watch('members');
  const totalPercentage = watchedMembers.reduce((sum, member) => sum + (member.percentage || 0), 0);

  // Calculate total orcamento value
  const watchedOrcamentos = form.watch('orcamentos') || [];
  const totalOrcamento = watchedOrcamentos.reduce((sum, orc) => sum + (orc.value || 0), 0);

  // Get available options based on selected type
  const getAvailableOptions = (type: 'cliente' | 'empresa' | 'grupo') => {
    switch (type) {
      case 'cliente': return clientes;
      case 'empresa': return empresas;
      case 'grupo': return grupos;
      default: return [];
    }
  };

  const getMemberName = (type: 'cliente' | 'empresa' | 'grupo', id: string) => {
    const options = getAvailableOptions(type);
    const option = options.find((item: any) => item.id.toString() === id);
    return option?.name || '';
  };

  const handleSalvarOrcamento = () => {
    const orcamentosComData = watchedOrcamentos.filter(orc => orc.predictedDate && orc.value > 0);
    if (orcamentosComData.length === 0) {
      toast({
        description: 'Adicione pelo menos um orçamento com data prevista e valor para gerar a previsão.',
        variant: 'destructive',
      });
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({
        description: 'A soma das porcentagens dos membros deve ser exatamente 100% para calcular a previsão.',
        variant: 'destructive',
      });
      return;
    }

    setShowPrevisaoAportes(true);
  };

  const handleGerarPrevisaoEdit = () => {
    const orcamentosComData = watchedOrcamentos.filter(orc => orc.predictedDate && orc.value > 0);
    if (orcamentosComData.length === 0) {
      toast({
        description: 'Adicione pelo menos um orçamento com data prevista e valor para gerar a previsão.',
        variant: 'destructive',
      });
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({
        description: 'A soma das porcentagens dos membros deve ser exatamente 100% para calcular a previsão.',
        variant: 'destructive',
      });
      return;
    }

    setShowPrevisaoAportesEdit(true);
  };

  // Get unique dates from orcamentos
  const getUniqueDates = () => {
    return [...new Set(
      watchedOrcamentos
        .filter(orc => orc.predictedDate && orc.value > 0)
        .map(orc => orc.predictedDate!.toISOString().split('T')[0])
    )].sort();
  };

  // Group orcamentos by date
  const getOrcamentosByDate = () => {
    const dates = getUniqueDates();
    return dates.reduce((acc, date) => {
      acc[date] = watchedOrcamentos
        .filter(orc => orc.predictedDate?.toISOString().split('T')[0] === date)
        .reduce((sum, orc) => sum + (orc.value || 0), 0);
      return acc;
    }, {} as Record<string, number>);
  };

  // Calculate member contribution for each date
  const getMemberContribution = (member: any, date: string) => {
    const orcamentosByDate = getOrcamentosByDate();
    const totalForDate = orcamentosByDate[date] || 0;
    return totalForDate * (member.percentage / 100);
  };

  // Get total contribution for a member across all dates
  const getMemberTotal = (member: any) => {
    const dates = getUniqueDates();
    return dates.reduce((total, date) => {
      return total + getMemberContribution(member, date);
    }, 0);
  };

  // Get total for a specific date across all members
  const getDateTotal = (date: string) => {
    return watchedMembers.reduce((total, member) => {
      return total + getMemberContribution(member, date);
    }, 0);
  };

  // Function to update orçamentos intelligently, preserving those with allocations
  const updateOrcamentosInteligente = async (projetoId: number, novosOrcamentos: any[]) => {
    const existentes = orcamentosExistentes || [];
    
    // Identify orçamentos to update, create, or delete
    const orcamentosParaAtualizar = [];
    const orcamentosParaCriar = [];
    const idsParaManter = new Set();

    // Process new orçamentos
    for (let i = 0; i < novosOrcamentos.length; i++) {
      const novoOrcamento = novosOrcamentos[i];
      const existente = existentes[i]; // Match by index/position

      if (existente && existente.id) {
        // Update existing orçamento
        orcamentosParaAtualizar.push({
          id: existente.id,
          ...novoOrcamento,
        });
        idsParaManter.add(existente.id);
      } else {
        // Create new orçamento
        orcamentosParaCriar.push({
          projetoId,
          ...novoOrcamento,
        });
      }
    }

    // Delete orçamentos that are no longer needed, but only if they have no allocations
    for (const existente of existentes) {
      if (!idsParaManter.has(existente.id)) {
        const temAlocacao = parseFloat(existente.valor_alocado || '0') > 0;
        if (!temAlocacao) {
          await deleteOrcamentoSemAlocacao({ orcamentoId: existente.id });
        } else {
          console.warn(`Orçamento ${existente.id} tem alocações e não pode ser removido`);
          toast({
            description: `Orçamento "${existente.description}" tem alocações e não pode ser removido. Apenas novos orçamentos serão criados.`,
            variant: 'default',
          });
        }
      }
    }

    // Update existing orçamentos
    for (const orcamento of orcamentosParaAtualizar) {
      await updateOrcamento({
        id: orcamento.id,
        description: orcamento.description,
        fornecedorId: orcamento.fornecedorId ? parseInt(orcamento.fornecedorId) : null,
        predictedDate: orcamento.predictedDate || null,
        value: orcamento.value,
      });
    }

    // Create new orçamentos
    for (const orcamento of orcamentosParaCriar) {
      await createOrcamento({
        projetoId: orcamento.projetoId,
        description: orcamento.description,
        fornecedorId: orcamento.fornecedorId ? parseInt(orcamento.fornecedorId) : null,
        predictedDate: orcamento.predictedDate || null,
        value: orcamento.value,
      });
    }
  };

  async function onSubmit(values: FormData) {
    // Validate total percentage
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({
        description: 'A soma das porcentagens dos membros deve ser exatamente 100%.',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate members
    const memberKeys = values.members.map(m => `${m.type}-${m.id}`);
    const uniqueKeys = new Set(memberKeys);
    if (memberKeys.length !== uniqueKeys.size) {
      toast({
        description: 'Não é possível adicionar o mesmo membro mais de uma vez.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let projetoId: number;

      if (projeto?.id || savedProjetoId) {
        const result = await updateProjeto({
          id: projeto?.id || savedProjetoId!,
          name: values.name,
          address: values.address || null,
          city: values.city || null,
          constructionSqft: values.constructionSqft || null,
          landSqft: values.landSqft || null,
          details: values.details || null,
          predictedSaleValue: values.predictedSaleValue || null,
          status: values.status,
        });
        projetoId = result[0].id;

        // Handle orçamentos update intelligently to preserve allocations
        await updateOrcamentosInteligente(projeto?.id || savedProjetoId!, values.orcamentos || []);
        
        // Only delete members if there are actual changes to avoid cascading deletes
        const currentMembers = projeto?.members || [];
        const newMembers = values.members;
        
        // For newly saved projects (savedProjetoId but no projeto.members), always update members
        const isNewlySavedProject = savedProjetoId && !projeto?.id;
        
        // Check if members have changed
        const membersChanged = isNewlySavedProject || 
          currentMembers.length !== newMembers.length || 
          !currentMembers.every((current, index) => {
            const newMember = newMembers[index];
            const currentId = current.cliente_id || current.empresa_id || current.grupo_id;
            const currentType = current.cliente_id ? 'cliente' : current.empresa_id ? 'empresa' : 'grupo';
            return currentId?.toString() === newMember.id && 
                   currentType === newMember.type && 
                   current.percentage === newMember.percentage;
          });

        if (membersChanged) {
          // Only delete and recreate if there are actual changes
          await deleteProjetoMembers({ projetoId: projeto?.id || savedProjetoId! });
          
          // Create new member relationships
          for (const member of values.members) {
            const params = {
              projetoId,
              clienteId: member.type === 'cliente' ? parseInt(member.id) : null,
              empresaId: member.type === 'empresa' ? parseInt(member.id) : null,
              grupoId: member.type === 'grupo' ? parseInt(member.id) : null,
              percentage: member.percentage,
            };

            await createProjetoMember(params);
          }
        }
      } else {
        const result = await createProjeto({
          name: values.name,
          address: values.address || null,
          city: values.city || null,
          constructionSqft: values.constructionSqft || null,
          landSqft: values.landSqft || null,
          details: values.details || null,
          predictedSaleValue: values.predictedSaleValue || null,
          status: values.status,
        });
        projetoId = result[0].id;
        setSavedProjetoId(projetoId);
      }

      // Create new member relationships (only for completely new projects)
      if (!projeto?.id && !savedProjetoId) {
        for (const member of values.members) {
          const params = {
            projetoId,
            clienteId: member.type === 'cliente' ? parseInt(member.id) : null,
            empresaId: member.type === 'empresa' ? parseInt(member.id) : null,
            grupoId: member.type === 'grupo' ? parseInt(member.id) : null,
            percentage: member.percentage,
          };

          await createProjetoMember(params);
        }
      }

      // Create orçamentos if any (only for completely new projects)
      if (!projeto?.id && !savedProjetoId) {
        for (const orcamento of values.orcamentos || []) {
          await createOrcamento({
            projetoId,
            description: orcamento.description,
            fornecedorId: orcamento.fornecedorId ? parseInt(orcamento.fornecedorId) : null,
            predictedDate: orcamento.predictedDate || null,
            value: orcamento.value,
          });
        }
      }



      toast({
        description: (projeto?.id || savedProjetoId) ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!',
      });

      // If it's a new project being created for the first time, don't close the form
      if (!projeto?.id && !savedProjetoId && !isNewProjectSaved) {
        setIsNewProjectSaved(true);
        // Don't call onSuccess() to keep the form open
        return;
      }

      // For existing projects or when saving after previsão is generated
      if (projeto?.id || isPrevisaoSaved) {
        onSuccess();
      }

      // Reset form only if we're closing
      if (!projeto?.id && !savedProjetoId && !isNewProjectSaved) {
        form.reset();
        setSavedProjetoId(null);
      }
    } catch (error) {
      toast({
        description: 'Erro ao salvar projeto. Tente novamente.',
        variant: 'destructive',
      });
    }
  }



  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle className="text-2xl">
          {projeto ? 'Editar Projeto' : 
           isNewProjectSaved ? 'Projeto Criado - Configure Previsão' : 
           'Cadastrar Novo Projeto'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="main" className="w-full">
              <TabsList className={`grid w-full ${readOnly ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="main">Informações Principais</TabsTrigger>
                {readOnly && (
                  <TabsTrigger value="evolucao" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Evolução
                  </TabsTrigger>
                )}
                <TabsTrigger value="photos" className="flex items-center gap-2">
                  <FileImage className="h-4 w-4" />
                  Fotos
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Projeto *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do projeto" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status do Projeto *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Em andamento">Em andamento</SelectItem>
                          <SelectItem value="Concluído">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Cidade" {...field} disabled={readOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="predictedSaleValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Previsto de Venda</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            disabled={readOnly}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="constructionSqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metragem Construção (sqft)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            disabled={readOnly}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="landSqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metragem Terreno (sqft)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            disabled={readOnly}
                          />
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
                        <Textarea placeholder="Endereço completo do projeto" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalhes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detalhes do projeto" {...field} disabled={readOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Members Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium">Membros do Projeto</h3>
                      <p className="text-sm text-muted-foreground">
                        Total: {totalPercentage.toFixed(2)}%
                        {Math.abs(totalPercentage - 100) > 0.01 && (
                          <Badge variant="destructive" className="ml-2">
                            Deve somar 100% (atual: {totalPercentage.toFixed(2)}%)
                          </Badge>
                        )}
                        {Math.abs(totalPercentage - 100) <= 0.01 && (
                          <Badge variant="default" className="ml-2">
                            ✓ Válido
                          </Badge>
                        )}
                      </p>
                      {/* Debug info para ajudar o usuário */}
                      {process.env.NODE_ENV === 'development' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Debug: Diferença de 100%: {Math.abs(totalPercentage - 100).toFixed(4)}% 
                          {Math.abs(totalPercentage - 100) > 0.01 ? ' (>0.01% - botão desabilitado)' : ' (≤0.01% - botão habilitado)'}
                        </p>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendMember({ type: 'cliente', id: '', percentage: 0 })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Membro
                      </Button>
                    )}
                  </div>

                  {memberFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border rounded">
                      <FormField
                        control={form.control}
                        name={`members.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo *</FormLabel>
                            <Select 
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue(`members.${index}.id`, '');
                              }} 
                              defaultValue={field.value}
                              disabled={readOnly}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cliente">Cliente</SelectItem>
                                <SelectItem value="empresa">Empresa</SelectItem>
                                <SelectItem value="grupo">Grupo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`members.${index}.id`}
                        render={({ field }) => {
                          const memberType = form.watch(`members.${index}.type`);
                          const options = getAvailableOptions(memberType);
                          
                          return (
                            <FormItem>
                              <FormLabel>
                                {memberType === 'cliente' ? 'Cliente *' : memberType === 'empresa' ? 'Empresa *' : 'Grupo *'}
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={`Selecione ${memberType}`} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {options.map((option: any) => (
                                    <SelectItem key={option.id} value={option.id.toString()}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name={`members.${index}.percentage`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Porcentagem (%) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                disabled={readOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex items-end">
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeMember(index)}
                            disabled={memberFields.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Orçamentos Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium">Orçamento do Projeto</h3>
                      <p className="text-sm text-muted-foreground">
                        Total: $ {totalOrcamento.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => appendOrcamento({ description: '', fornecedorId: '', value: 0 })}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Item
                        </Button>
                        {orcamentoFields.length > 0 && totalOrcamento > 0 && (
                          <>
                            {(!projeto?.id && !isNewProjectSaved) ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled
                                title="Salve o projeto primeiro para gerar a previsão"
                              >
                                <Calculator className="h-4 w-4 mr-2" />
                                Gerar Previsão (Salve primeiro)
                              </Button>
                            ) : (!projeto?.id && isNewProjectSaved) ? (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={handleSalvarOrcamento}
                                disabled={Math.abs(totalPercentage - 100) > 0.01}
                                title={Math.abs(totalPercentage - 100) > 0.01 ? 'A soma das porcentagens dos membros deve ser exatamente 100%' : ''}
                              >
                                <Calculator className="h-4 w-4 mr-2" />
                                {showPrevisaoAportes ? 'Ocultar Previsão' : 'Gerar Previsão de Aportes'}
                              </Button>
                            ) : !hasExistingPrevisao ? (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={handleGerarPrevisaoEdit}
                                disabled={Math.abs(totalPercentage - 100) > 0.01}
                                title={Math.abs(totalPercentage - 100) > 0.01 ? 'A soma das porcentagens dos membros deve ser exatamente 100%' : ''}
                              >
                                <Calculator className="h-4 w-4 mr-2" />
                                Gerar Previsão de Aportes
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => setShowPrevisaoModal(true)}
                                disabled={Math.abs(totalPercentage - 100) > 1}
                                title={Math.abs(totalPercentage - 100) > 1 ? 'A soma das porcentagens dos membros deve estar próxima de 100%' : ''}
                              >
                                <Calculator className="h-4 w-4 mr-2" />
                                Atualizar Previsão
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {orcamentoFields.length > 0 && (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Previsão</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orcamentoFields.map((field, index) => (
                            <TableRow key={field.id}>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`orcamentos.${index}.description`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input placeholder="Descrição" {...field} disabled={readOnly} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`orcamentos.${index}.fornecedorId`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Fornecedor" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {fornecedores.map((fornecedor: any) => (
                                            <SelectItem key={fornecedor.id} value={fornecedor.id.toString()}>
                                              {fornecedor.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`orcamentos.${index}.predictedDate`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <DatePicker
                                          date={field.value}
                                          onDateChange={field.onChange}
                                          disabled={readOnly}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`orcamentos.${index}.value`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder="0.00"
                                          {...field}
                                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                          disabled={readOnly}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                {!readOnly && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeOrcamento(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Previsão de Aportes Section - For new projects that are saved */}
                  {!readOnly && !projeto?.id && isNewProjectSaved && showPrevisaoAportes && orcamentoFields.length > 0 && totalOrcamento > 0 && (
                    <div className="mt-8">
                      <PrevisaoAportesManager
                        projetoId={savedProjetoId || 0}
                        orcamentosByDate={getOrcamentosByDate()}
                        onSaved={() => {
                          console.log('Previsão de aportes salva, resetando estado de submissão...');
                          setIsPrevisaoSaved(true);
                          toast({
                            description: 'Previsão de aportes cadastrada! Use "Salvar Alterações" se precisar salvar o projeto novamente.',
                          });
                          setShowPrevisaoAportes(false);
                          
                          // Force form to not be in submitting state
                          setTimeout(() => {
                            setIsPrevisaoSaved(false);
                          }, 100);
                        }}
                      />
                    </div>
                  )}

                  {/* Previsão de Aportes Section - For existing projects without previsão */}
                  {!readOnly && projeto?.id && showPrevisaoAportesEdit && !hasExistingPrevisao && orcamentoFields.length > 0 && totalOrcamento > 0 && (
                    <div className="mt-8">
                      <PrevisaoAportesManager
                        projetoId={projeto.id}
                        orcamentosByDate={getOrcamentosByDate()}
                        onSaved={() => {
                          toast({
                            description: 'Previsão de aportes criada com sucesso!',
                          });
                          setShowPrevisaoAportesEdit(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              {readOnly && (
                <TabsContent value="evolucao" className="space-y-6">
                  {projeto?.id ? (
                    <ProjetoEvolucao 
                      projetoId={projeto.id} 
                      projetoName={projeto.name}
                      projetoStatus={projeto.status}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <p>Evolução disponível apenas para projetos salvos.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              <TabsContent value="photos" className="space-y-6">
                {(savedProjetoId || projeto?.id) ? (
                  <FileManager
                    entityType="projeto_photo"
                    entityId={savedProjetoId || projeto!.id}
                    acceptedTypes="image/*"
                    title="Fotos do Projeto"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Salve o projeto primeiro para fazer upload de fotos.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                {(savedProjetoId || projeto?.id) ? (
                  <FileManager
                    entityType="projeto_document"
                    entityId={savedProjetoId || projeto!.id}
                    acceptedTypes=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    title="Documentos do Projeto"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Salve o projeto primeiro para fazer upload de documentos.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-4 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  {readOnly ? 'Fechar' : 'Cancelar'}
                </Button>
              )}
              {!readOnly && (
                <Button 
                  type="submit" 
                  disabled={isSubmitting && !isPrevisaoSaved}
                >
                  {isSubmitting && !isPrevisaoSaved ? 'Salvando...' : 
                   projeto ? 'Atualizar Projeto' : 
                   isNewProjectSaved ? 'Salvar Alterações' : 
                   'Criar Projeto'}
                </Button>
              )}
            </div>
          </form>
        </Form>
        
        {/* Modal para editar previsão de aportes - Only for existing projects */}
        {projeto?.id && showPrevisaoModal && (
          <PrevisaoAportesEditModal
            projetoId={projeto.id}
            isOpen={showPrevisaoModal}
            onClose={() => setShowPrevisaoModal(false)}
            onSaved={() => {
              toast({
                description: 'Previsão de aportes atualizada com sucesso!',
              });
              setShowPrevisaoModal(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
