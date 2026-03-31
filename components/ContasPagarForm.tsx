'use client';

import React, { useState, useRef } from 'react';
import { validarPeriodoBloqueado } from '@/hooks/use-periodo-bloqueado';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileManager } from '@/components/FileManager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Save, Plus, Trash2, Calculator, CreditCard, Upload, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, parseLocalDate } from '@/utils/timezone';
import {
  FinanceDetailHeader,
  FinanceDetailSectionCard,
  financeDetailCardClassName,
  financeDetailFieldClassName,
  financeDetailMutedPanelClassName,
  financeDetailTableWrapClassName,
  financeDetailTabsListClassName,
  financeDetailTabsTriggerClassName,
  financeDetailTextareaClassName,
} from '@/components/finance/detail-ui';
import loadFornecedoresAction from '@/actions/loadFornecedores';
import loadTiposDocumentoAction from '@/actions/loadTiposDocumento';
import loadProdutosDebitoAction from '@/actions/loadProdutosDebito';
import loadProjetosAtivosAction from '@/actions/loadProjetosAtivos';
import loadContasAction from '@/actions/loadContas';
import createContaPagarAction from '@/actions/createContaPagar';
import createContaPagarItemAction from '@/actions/createContaPagarItem';
import createContaPagarProjetoAction from '@/actions/createContaPagarProjeto';
import createTituloPagarAction from '@/actions/createTituloPagar';
import payTituloPagarAction from '@/actions/payTituloPagar';
import uploadFileAction from '@/actions/uploadFile';
import updateContaPagarAction from '@/actions/updateContaPagar';
import loadContaPagarItensAction from '@/actions/loadContaPagarItens';
import loadContaPagarProjetosAction from '@/actions/loadContaPagarProjetos';
import deleteContaPagarItensAction from '@/actions/deleteContaPagarItens';
import deleteContaPagarProjetosAction from '@/actions/deleteContaPagarProjetos';
import loadOrcamentosByProjetoAction from '@/actions/loadOrcamentosByProjeto';
import loadContaPagarOrcamentoAlocacoesAction from '@/actions/loadContaPagarOrcamentoAlocacoes';
import createContaPagarOrcamentoAlocacaoAction from '@/actions/createContaPagarOrcamentoAlocacao';
import deleteContaPagarOrcamentoAlocacoesAction from '@/actions/deleteContaPagarOrcamentoAlocacoes';
import loadTitulosByContaPagarAction from '@/actions/loadTitulosByContaPagar';
import updateTituloPagarAction from '@/actions/updateTituloPagar';
import loadMatrizesAction from '@/actions/loadMatrizes';
import { PaymentModalContent } from '@/components/ContasPagarPaymentModal';

const itemSchema = z.object({
  produto_id: z.number().min(1, 'Produto é obrigatório'),
  quantidade: z.number().min(0.01, 'Quantidade deve ser maior que zero'),
  valor_unitario: z.number().min(0.01, 'Valor unitário deve ser maior que zero'),
  valor_total: z.number(),
});

const projetoRateioSchema = z.object({
  projeto_id: z.number().min(1, 'Projeto é obrigatório'),
  percentual: z.number().min(0.01, 'Percentual deve ser maior que zero').max(100, 'Percentual não pode ser maior que 100'),
  valor_rateio: z.number(),
});

const orcamentoAlocacaoSchema = z.object({
  orcamento_id: z.number(),
  valor_alocado: z.number().min(0, 'Valor deve ser maior ou igual a zero'),
  observacoes: z.string().optional(),
});

const formSchema = z.object({
  matriz_id: z.number().min(1, 'Matriz é obrigatória'),
  fornecedor_id: z.number().min(1, 'Fornecedor é obrigatório'),
  tipo_documento_id: z.number().min(1, 'Tipo de documento é obrigatório'),
  numero_documento: z.string().min(1, 'Número do documento é obrigatório'),
  data_emissao: z.date(),
  data_vencimento: z.date(),
  data_competencia: z.date(),
  observacoes: z.string().optional(),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
  projetos_rateio: z.array(projetoRateioSchema),
  parcelas: z.number().min(1, 'Número de parcelas deve ser maior que zero'),
});

interface ProjetoOrcamentoAlocacaoProps {
  projetoId: number;
  projetoNome: string;
  valorRateio: number;
  alocacoes: Record<number, number>;
  onAlocacaoChange: (orcamentoId: number, valor: number) => void;
  isCompleta: boolean;
  valorDisponivel: number;
  totalAlocado: number;
  formatCurrency: (value: number) => string;
  projetoStatus?: string;
}

function ProjetoOrcamentoAlocacao({ 
  projetoId, 
  projetoNome, 
  valorRateio, 
  alocacoes, 
  onAlocacaoChange,
  isCompleta,
  valorDisponivel,
  totalAlocado,
  formatCurrency,
  projetoStatus 
}: ProjetoOrcamentoAlocacaoProps) {
  // Load budget items for this specific project
  const [orcamentos] = useLoadAction(loadOrcamentosByProjetoAction, [], { projetoId });
  const isProjetoConcluido = projetoStatus === 'Concluído';

  if (!orcamentos || orcamentos.length === 0) {
    return (
      <Card className={financeDetailCardClassName}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/70">
          <CardTitle className="flex items-center gap-2">
            {projetoNome}
            <Badge variant="secondary" className="text-xs">
              Sem orçamentos
            </Badge>
            {isProjetoConcluido && (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                Projeto Concluído
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Valor do rateio: {formatCurrency(valorRateio)} - Este projeto não possui orçamentos cadastrados.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={financeDetailCardClassName}>
      <CardHeader className="border-b border-slate-100 bg-slate-50/70">
        <CardTitle className="flex items-center gap-2">
          {projetoNome}
          <Badge variant={isCompleta ? "default" : "destructive"} className="text-xs">
            {isCompleta ? "Obrigatório ✓" : "Obrigatório"}
          </Badge>
          {isProjetoConcluido && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
              Projeto Concluído
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          <strong>Valor do rateio:</strong> {formatCurrency(valorRateio)} - {isProjetoConcluido ? 'Este projeto está concluído e não pode ter alocações alteradas' : 'Aloque este valor nas linhas do orçamento abaixo'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`grid grid-cols-3 gap-4 p-3 rounded-lg border ${isCompleta ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div>
              <span className="text-sm font-medium">Valor do Rateio:</span>
              <div className="text-lg font-bold text-blue-600">{formatCurrency(valorRateio)}</div>
              <p className="text-xs text-muted-foreground">Para este projeto</p>
            </div>
            <div>
              <span className="text-sm font-medium">Alocado:</span>
              <div className={`text-lg font-bold ${isCompleta ? 'text-green-600' : 'text-orange-600'}`}>
                {formatCurrency(totalAlocado)}
              </div>
              <p className="text-xs text-muted-foreground">
                {valorRateio > 0 ? ((totalAlocado / valorRateio) * 100).toFixed(1) : 0}% do rateio
              </p>
            </div>
            <div>
              <span className="text-sm font-medium">Disponível:</span>
              <div className={`text-lg font-bold ${valorDisponivel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(valorDisponivel)}
              </div>
              <p className="text-xs text-muted-foreground">
                {valorDisponivel > 0 ? 'Falta alocar' : valorDisponivel < 0 ? 'Excesso' : 'Completo'}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data Prevista</TableHead>
                <TableHead>Valor Orçado</TableHead>
                <TableHead>Valor Executado</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Alocar Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentos.map((orcamento: any) => (
                <TableRow key={orcamento.id}>
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="truncate" title={orcamento.description}>
                      {orcamento.description}
                    </div>
                  </TableCell>
                  <TableCell>{orcamento.fornecedor_nome || '-'}</TableCell>
                  <TableCell>
                    {orcamento.predicted_date ? new Date(orcamento.predicted_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{formatCurrency(parseFloat(orcamento.valor_orcado || 0))}</TableCell>
                  <TableCell>
                    <span className="text-blue-600 font-medium">
                      {formatCurrency(parseFloat(orcamento.valor_executado || 0))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${parseFloat(orcamento.valor_saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(parseFloat(orcamento.valor_saldo || 0))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={alocacoes[orcamento.id] || ''}
                      onChange={(e) => {
                        const valor = parseFloat(e.target.value) || 0;
                        onAlocacaoChange(orcamento.id, valor);
                      }}
                      className={`w-24 ${financeDetailFieldClassName}`}
                      disabled={isProjetoConcluido}
                      title={isProjetoConcluido ? "Projeto concluído - não é possível alterar alocações" : ""}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isCompleta && !isProjetoConcluido && (
            <div className={`p-3 border rounded-lg ${valorDisponivel > 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold ${valorDisponivel > 0 ? 'bg-orange-500' : 'bg-red-500'}`}>
                  !
                </div>
                <p className={`text-sm ${valorDisponivel > 0 ? 'text-orange-800' : 'text-red-800'}`}>
                  {valorDisponivel > 0 
                    ? `Faltam ${formatCurrency(valorDisponivel)} para completar a alocação deste projeto.` 
                    : `Excesso de ${formatCurrency(Math.abs(valorDisponivel))} na alocação deste projeto.`
                  }
                </p>
              </div>
            </div>
          )}
          
          {isProjetoConcluido && (
            <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold bg-blue-500">
                  i
                </div>
                <p className="text-sm text-blue-800">
                  Este projeto está com status "Concluído". Não é possível alterar as alocações de orçamento.
                  As alocações existentes permanecem inalteradas.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ContasPagarFormProps {
  conta?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContasPagarForm({ conta, onSuccess, onCancel }: ContasPagarFormProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [generatedTitulos, setGeneratedTitulos] = useState<any[]>([]);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);
  const [contaPagarId, setContaPagarId] = useState<number | null>(conta?.id || null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<number | null>(null);
  const [orcamentosAlocacoes, setOrcamentosAlocacoes] = useState<Record<number, Record<number, number>>>({});
  const [rateioConfirmado, setRateioConfirmado] = useState(false);
  const [titulosEditaveis, setTitulosEditaveis] = useState<Record<number, Date>>({});
  const [parcelasPreview, setParcelasPreview] = useState<Array<{ parcela: number; data_vencimento: Date; valor: number }>>([]);
  const [showSaveAndPayModal, setShowSaveAndPayModal] = useState(false);
  const [contaIdParaPagamento, setContaIdParaPagamento] = useState<number | null>(null);
  const saveAndPayRef = useRef(false);
  const isEditing = !!conta;
  const [paymentForm, setPaymentForm] = useState({
    conta_id: '',
    data_pagamento: new Date(),
    observacoes: '',
  });

  // Data loading
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [fornecedores] = useLoadAction(loadFornecedoresAction, [], { searchTerm: null });
  const [tiposDocumento] = useLoadAction(loadTiposDocumentoAction, [], { searchDescricao: null });
  const [produtos] = useLoadAction(loadProdutosDebitoAction, []);
  
  // Prepare produto options for combobox (sorted alphabetically)
  const produtoOptions = React.useMemo(() => {
    if (!produtos) return [];
    return produtos
      .map((produto: any) => ({
        value: produto.id.toString(),
        label: produto.descricao || '',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [produtos]);
  const [projetos] = useLoadAction(loadProjetosAtivosAction, []);
  const [contas] = useLoadAction(loadContasAction, []);

  // Load existing items and projects when editing
  const [existingItens] = useLoadAction(loadContaPagarItensAction, [], { contaPagarId: conta?.id || null });
  const [existingProjetos] = useLoadAction(loadContaPagarProjetosAction, [], { contaPagarId: conta?.id || null });
  const [existingAlocacoes] = useLoadAction(loadContaPagarOrcamentoAlocacoesAction, [], { contaPagarId: conta?.id || null });
  const [existingTitulos] = useLoadAction(loadTitulosByContaPagarAction, [], { contaPagarId: conta?.id || null });
  
  // Load budget items for selected project
  const [orcamentos] = useLoadAction(loadOrcamentosByProjetoAction, [], { projetoId: selectedProjetoId });

  // Mutations
  const [createContaPagar, isCreating] = useMutateAction(createContaPagarAction);
  const [updateContaPagar, isUpdating] = useMutateAction(updateContaPagarAction);
  const [createContaPagarItem] = useMutateAction(createContaPagarItemAction);
  const [createContaPagarProjeto] = useMutateAction(createContaPagarProjetoAction);
  const [deleteContaPagarItens] = useMutateAction(deleteContaPagarItensAction);
  const [deleteContaPagarProjetos] = useMutateAction(deleteContaPagarProjetosAction);
  const [createTituloPagar] = useMutateAction(createTituloPagarAction);
  const [payTituloPagar] = useMutateAction(payTituloPagarAction);
  const [uploadFile] = useMutateAction(uploadFileAction);
  const [createContaPagarOrcamentoAlocacao] = useMutateAction(createContaPagarOrcamentoAlocacaoAction);
  const [deleteContaPagarOrcamentoAlocacoes] = useMutateAction(deleteContaPagarOrcamentoAlocacoesAction);
  const [updateTituloPagar] = useMutateAction(updateTituloPagarAction);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      matriz_id: Number(conta?.matriz_id) || 1,
      fornecedor_id: Number(conta?.fornecedor_id) || 1,
      tipo_documento_id: Number(conta?.tipo_documento_id) || 1,
      numero_documento: conta?.numero_documento ? String(conta.numero_documento) : '',
      data_emissao: conta?.data_emissao ? parseLocalDate(conta.data_emissao) : new Date(),
      data_vencimento: conta?.data_vencimento ? parseLocalDate(conta.data_vencimento) : new Date(),
      data_competencia: conta?.data_competencia ? parseLocalDate(conta.data_competencia) : new Date(),
      observacoes: conta?.observacoes ? String(conta.observacoes) : '',
      itens: [],
      projetos_rateio: [],
      parcelas: 1,
    },
  });

  const { fields: itensFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: 'itens',
  });

  const { fields: projetosFields, append: appendProjeto, remove: removeProjeto } = useFieldArray({
    control: form.control,
    name: 'projetos_rateio',
  });

  // Watch form values (must be before useEffect hooks that use them)
  const watchedItens = form.watch('itens');
  const watchedProjetosRateio = form.watch('projetos_rateio');

  // Load existing data when editing
  React.useEffect(() => {
    if (isEditing && existingItens && existingItens.length > 0 && itensFields.length === 0) {
      // Add items from database
      existingItens.forEach((item: any) => {
        appendItem({
          produto_id: item.produto_id,
          quantidade: parseFloat(item.quantidade) || 0,
          valor_unitario: parseFloat(item.valor_unitario) || 0,
          valor_total: parseFloat(item.valor_total) || 0,
        });
      });
    }
  }, [existingItens, isEditing, itensFields.length, appendItem]);

  React.useEffect(() => {
    if (isEditing && existingProjetos && existingProjetos.length > 0 && projetosFields.length === 0) {
      // Add projects from database
      existingProjetos.forEach((projeto: any) => {
        appendProjeto({
          projeto_id: projeto.projeto_id,
          percentual: parseFloat(projeto.percentual) || 0,
          valor_rateio: parseFloat(projeto.valor_rateio) || 0,
        });
      });
    }
  }, [existingProjetos, isEditing, projetosFields.length, appendProjeto]);

  // Load existing budget allocations grouped by project
  React.useEffect(() => {
    if (existingAlocacoes && existingAlocacoes.length > 0) {
      const alocacoesMap: Record<number, Record<number, number>> = {};
      
      // Group allocations by project ID (now available from the query)
      existingAlocacoes.forEach((alocacao: any) => {
        const projetoId = alocacao.projeto_id;
        if (projetoId) {
          if (!alocacoesMap[projetoId]) {
            alocacoesMap[projetoId] = {};
          }
          alocacoesMap[projetoId][alocacao.orcamento_id] = parseFloat(alocacao.valor_alocado) || 0;
        }
      });
      
      setOrcamentosAlocacoes(alocacoesMap);
    }
  }, [existingAlocacoes]);

  // Load existing rateio confirmation when editing
  React.useEffect(() => {
    if (isEditing && existingProjetos && existingProjetos.length > 0) {
      setRateioConfirmado(true);
    }
  }, [existingProjetos, isEditing]);

  // Load existing títulos data when editing
  React.useEffect(() => {
    if (existingTitulos && existingTitulos.length > 0) {
      const titulosMap: Record<number, Date> = {};
      existingTitulos.forEach((titulo: any) => {
        titulosMap[titulo.id] = parseLocalDate(titulo.data_vencimento);
      });
      setTitulosEditaveis(titulosMap);
    }
  }, [existingTitulos]);

  // Calculate totals
  const valorTotalItens = (watchedItens || []).reduce((total, item) => {
    const quantidade = item.quantidade || 0;
    const valorUnitario = item.valor_unitario || 0;
    return total + (quantidade * valorUnitario);
  }, 0);

  const percentualTotalRateio = (watchedProjetosRateio || []).reduce((total, projeto) => {
    return total + (projeto.percentual || 0);
  }, 0);

  const addItem = () => {
    appendItem({
      produto_id: 0,
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
    });
  };

  const addProjeto = () => {
    appendProjeto({
      projeto_id: 0,
      percentual: 0,
      valor_rateio: 0,
    });
  };

  const updateItemTotal = (index: number) => {
    const item = watchedItens?.[index];
    if (item) {
      const total = (item.quantidade || 0) * (item.valor_unitario || 0);
      form.setValue(`itens.${index}.valor_total`, total);
    }
  };

  const updateProjetoRateio = (index: number) => {
    const projeto = watchedProjetosRateio?.[index];
    if (projeto && valorTotalItens > 0) {
      const valorRateio = valorTotalItens * (projeto.percentual / 100);
      form.setValue(`projetos_rateio.${index}.valor_rateio`, valorRateio);
    }
  };

  const handleOrcamentoAlocacaoChange = (projetoId: number, orcamentoId: number, valor: number) => {
    setOrcamentosAlocacoes(prev => ({
      ...prev,
      [projetoId]: {
        ...prev[projetoId],
        [orcamentoId]: valor
      }
    }));
  };

  const getTotalAlocacoesByProjeto = (projetoId: number) => {
    const projetoAlocacoes = orcamentosAlocacoes[projetoId] || {};
    return Object.values(projetoAlocacoes).reduce((total, valor) => total + (valor || 0), 0);
  };

  const getTotalAlocacoes = () => {
    return Object.values(orcamentosAlocacoes).reduce((totalProjetos, projetoAlocacoes) => {
      return totalProjetos + Object.values(projetoAlocacoes).reduce((totalProjeto, valor) => totalProjeto + (valor || 0), 0);
    }, 0);
  };

  const getValorRateioProjeto = (projetoId: number) => {
    const projeto = watchedProjetosRateio?.find(p => p.projeto_id === projetoId);
    return projeto ? valorTotalItens * (projeto.percentual / 100) : 0;
  };

  const getValorDisponivelProjeto = (projetoId: number) => {
    return getValorRateioProjeto(projetoId) - getTotalAlocacoesByProjeto(projetoId);
  };

  const isAlocacaoCompletaProjeto = (projetoId: number) => {
    return Math.abs(getValorDisponivelProjeto(projetoId)) < 0.01;
  };

  const isAlocacaoCompleta = () => {
    if (!rateioConfirmado) return true;
    
    // Para cada projeto com orçamentos, verificar se a alocação está completa
    for (const projeto of watchedProjetosRateio || []) {
      if (projeto.projeto_id) {
        // Verificar se o projeto tem orçamentos (carregamos apenas o primeiro, mas aqui verificamos todos)
        if (!isAlocacaoCompletaProjeto(projeto.projeto_id)) {
          return false;
        }
      }
    }
    return true;
  };

  const handleSalvarRateio = () => {
    if (Math.abs(percentualTotalRateio - 100) > 0.01) {
      toast({
        title: "Erro de validação",
        description: "O total do rateio deve ser exatamente 100% antes de confirmar",
        variant: "destructive",
      });
      return;
    }
    setRateioConfirmado(true);
    setSelectedProjetoId(null); // Reset para carregar orçamentos de todos os projetos
  };

  const handleEditarRateio = () => {
    setRateioConfirmado(false);
    setOrcamentosAlocacoes({}); // Limpar alocações quando editar rateio
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setPendingFiles(prev => [...prev, ...Array.from(files)]);
    }
    event.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPendingFiles = async (contaPagarId: number) => {
    for (const file of pendingFiles) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
        });

        reader.readAsDataURL(file);
        const base64String = await base64Promise;

        await uploadFile({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
          fileData: base64String,
          entityType: 'conta_pagar',
          entityId: contaPagarId,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const generateParcelas = (dataVencimento: Date, totalParcelas: number, valor: number) => {
    const parcelas = [];
    for (let i = 0; i < totalParcelas; i++) {
      const dataVencimentoParcela = new Date(dataVencimento);
      dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);
      
      parcelas.push({
        parcela: i + 1,
        total_parcelas: totalParcelas,
        data_vencimento: dataVencimentoParcela,
        valor: valor / totalParcelas,
      });
    }
    return parcelas;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // If editing and has payments, don't allow saving
    if (isEditing && conta.titulos_pagos > 0) {
      toast({
        title: "Não é possível editar",
        description: "Esta conta possui pagamentos efetuados e não pode ser modificada.",
        variant: "destructive",
      });
      return;
    }

    // Debug: Log values being submitted
    console.log('Submitting conta a pagar with values:', {
      matriz_id: values.matriz_id,
      fornecedor_id: values.fornecedor_id,
      tipo_documento_id: values.tipo_documento_id,
      numero_documento: values.numero_documento,
      valor_total: valorTotalItens,
      valor_original: conta?.valor_total,
      is_valor_changed: isEditing && parseFloat(conta?.valor_total || 0) !== valorTotalItens
    });

    try {
      // Validar período bloqueado para competência
      const validacaoPeriodo = await validarPeriodoBloqueado({
        matrizId: values.matriz_id,
        dataCompetencia: values.data_competencia,
      });
      if (validacaoPeriodo.bloqueado) {
        toast({ title: 'Período Bloqueado', description: validacaoPeriodo.mensagem, variant: 'destructive' });
        return;
      }

      // Check if any project is concluded and has budget allocation changes
      const projetosConcluidos = values.projetos_rateio
        .map(p => projetos?.find(proj => proj.id === p.projeto_id))
        .filter(p => p?.status === 'Concluído');
      
      if (projetosConcluidos.length > 0) {
        // Check if there are allocations for concluded projects
        const hasAlocacoesConcluidos = projetosConcluidos.some(projeto => 
          projeto && orcamentosAlocacoes[projeto.id] && 
          Object.values(orcamentosAlocacoes[projeto.id]).some(valor => valor > 0)
        );
        
        if (hasAlocacoesConcluidos) {
          toast({
            title: "Erro de validação",
            description: `Não é possível criar alocações de orçamento para projetos com status "Concluído": ${projetosConcluidos.map(p => p?.name).join(', ')}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validation - only check project percentages if there are projects
      if (values.projetos_rateio.length > 0 && Math.abs(percentualTotalRateio - 100) > 0.01) {
        toast({
          title: "Erro de validação",
          description: "O total do rateio deve ser exatamente 100%",
          variant: "destructive",
        });
        return;
      }

      // Validate budget allocation when project has budgets - only if there are projects
      if (values.projetos_rateio.length > 0 && !isAlocacaoCompleta()) {
        toast({
          title: "Erro de validação",
          description: "O valor total da conta deve ser 100% alocado no orçamento do projeto",
          variant: "destructive",
        });
        return;
      }

      // Validation - check if parcelas preview total matches valor total
      if (!isEditing && parcelasPreview.length > 0) {
        const totalParcelas = parcelasPreview.reduce((sum, p) => sum + p.valor, 0);
        if (Math.abs(totalParcelas - valorTotalItens) > 0.01) {
          toast({
            title: "Erro de validação",
            description: "O total das parcelas deve ser igual ao valor total dos itens",
            variant: "destructive",
          });
          return;
        }
      }

      let currentContaPagarId: number;

      if (isEditing) {
        // Update existing conta a pagar
        await updateContaPagar({
          id: conta.id,
          matriz_id: values.matriz_id,
          fornecedor_id: values.fornecedor_id,
          tipo_documento_id: values.tipo_documento_id,
          numero_documento: values.numero_documento,
          data_emissao: formatDateForDatabase(values.data_emissao),
          data_vencimento: formatDateForDatabase(values.data_vencimento),
          data_competencia: formatDateForDatabase(values.data_competencia),
          observacoes: values.observacoes,
          valor_total: valorTotalItens,
        });

        currentContaPagarId = conta.id;

        // Delete existing items, projects and allocations
        await deleteContaPagarItens({ contaPagarId: conta.id });
        await deleteContaPagarProjetos({ contaPagarId: conta.id });
        await deleteContaPagarOrcamentoAlocacoes({ contaPagarId: conta.id });
      } else {
        // Create new conta a pagar
        const contaPagarResult = await createContaPagar({
          matriz_id: values.matriz_id,
          fornecedor_id: values.fornecedor_id,
          tipo_documento_id: values.tipo_documento_id,
          numero_documento: values.numero_documento,
          data_emissao: formatDateForDatabase(values.data_emissao),
          data_vencimento: formatDateForDatabase(values.data_vencimento),
          data_competencia: formatDateForDatabase(values.data_competencia),
          observacoes: values.observacoes || '',
          valor_total: valorTotalItens,
        });

        currentContaPagarId = contaPagarResult[0].id;
        setContaPagarId(currentContaPagarId);
      }

      // Create/recreate items
      for (const item of values.itens) {
        await createContaPagarItem({
          conta_pagar_id: currentContaPagarId,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.quantidade * item.valor_unitario,
        });
      }

      // Create/recreate project allocations (only if there are projects)
      if (values.projetos_rateio.length > 0) {
        for (const projeto of values.projetos_rateio) {
          await createContaPagarProjeto({
            conta_pagar_id: currentContaPagarId,
            projeto_id: projeto.projeto_id,
            percentual: projeto.percentual,
            valor_rateio: valorTotalItens * (projeto.percentual / 100),
          });
        }

        // Create/recreate budget allocations for all projects
        for (const [projetoId, projetoAlocacoes] of Object.entries(orcamentosAlocacoes)) {
          for (const [orcamentoId, valorAlocado] of Object.entries(projetoAlocacoes)) {
            if (valorAlocado && valorAlocado > 0) {
              await createContaPagarOrcamentoAlocacao({
                conta_pagar_id: currentContaPagarId,
                orcamento_id: parseInt(orcamentoId),
                valor_alocado: valorAlocado,
                observacoes: '',
              });
            }
          }
        }
      }

      if (!isEditing) {
        // Generate parcelas/títulos only for new accounts
        const parcelas = parcelasPreview.length > 0 
          ? parcelasPreview.map((p, i) => ({ ...p, total_parcelas: values.parcelas }))
          : generateParcelas(values.data_vencimento, values.parcelas, valorTotalItens);
        const titulosGerados = [];
        
        for (const parcela of parcelas) {
          const tituloResult = await createTituloPagar({
            conta_pagar_id: currentContaPagarId,
            parcela: parcela.parcela,
            total_parcelas: parcela.total_parcelas,
            data_vencimento: parcela.data_vencimento.toISOString().split('T')[0],
            valor: parcela.valor,
          });
          titulosGerados.push({ ...parcela, id: tituloResult[0]?.id });
        }

        // Upload pending files
        if (pendingFiles.length > 0) {
          await uploadPendingFiles(currentContaPagarId);
        }

        const shouldOpenPaymentModal = saveAndPayRef.current;
        saveAndPayRef.current = false;

        toast({
          title: "Conta a pagar criada",
          description: `Conta criada com ${values.parcelas} título(s) gerado(s)${pendingFiles.length > 0 ? ` e ${pendingFiles.length} arquivo(s) anexado(s)` : ''}`,
        });

        if (shouldOpenPaymentModal) {
          setContaIdParaPagamento(currentContaPagarId);
          setShowSaveAndPayModal(true);
        } else {
          onSuccess();
        }
      } else {
        toast({
          title: "Conta a pagar atualizada",
          description: "Conta atualizada com sucesso.",
        });
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving conta a pagar:', error);
      toast({
        title: "Erro",
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} a conta a pagar. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  const handlePayment = async () => {
    try {
      for (const index of selectedTitulos) {
        const titulo = generatedTitulos[index];
        await payTituloPagar({
          id: titulo.id,
          valor_pago: titulo.valor,
          data_pagamento: paymentForm.data_pagamento.toISOString().split('T')[0],
          conta_id: parseInt(paymentForm.conta_id),
          observacoes_pagamento: paymentForm.observacoes,
        });
      }

      toast({
        title: "Pagamento realizado",
        description: `${selectedTitulos.length} título(s) pago(s) com sucesso`,
      });
      onSuccess();
    } catch (error) {
      console.error('Error paying títulos:', error);
      toast({
        title: "Erro no pagamento",
        description: "Não foi possível realizar o pagamento",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 pb-6">
      <FinanceDetailHeader
        title={isEditing ? 'Conta a Pagar' : 'Nova Conta a Pagar'}
        subtitle={
          isEditing
            ? conta.titulos_pagos > 0
              ? 'Visualização da conta com pagamentos já efetuados, mantendo toda a rastreabilidade financeira.'
              : 'Edite as informações da conta a pagar com uma navegação mais leve, clara e organizada.'
            : 'Preencha os dados da nova conta a pagar em uma estrutura mais limpa, elegante e objetiva.'
        }
        onBack={onCancel}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 [&_label]:text-[0.82rem] [&_label]:font-semibold [&_label]:tracking-[0.01em] [&_label]:text-slate-600"
        >
          <Tabs defaultValue="geral" className="space-y-6">
            <TabsList className={financeDetailTabsListClassName}>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="geral">Dados Gerais</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="itens">Itens</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="projetos">Projetos</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="anexos">Anexos</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="pagamento">Parcelamento</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4">
              <FinanceDetailSectionCard
                title="Informações Gerais"
                description="Dados principais da conta, com foco em leitura rápida, boa hierarquia e mais respiro visual."
                contentClassName="space-y-5"
              >
                  <FormField
                    control={form.control}
                    name="matriz_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Matriz *</FormLabel>
                        <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger className={financeDetailFieldClassName}>
                              <SelectValue placeholder="Selecione a matriz" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {matrizes?.map((matriz: any) => (
                              <SelectItem key={matriz.id} value={matriz.id.toString()}>
                                {matriz.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fornecedor_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fornecedor *</FormLabel>
                          <Select 
                            value={field.value > 0 ? field.value.toString() : ""} 
                            onValueChange={(value) => field.onChange(parseInt(value) || 0)}
                          >
                            <FormControl>
                              <SelectTrigger className={financeDetailFieldClassName}>
                                <SelectValue placeholder="Selecione o fornecedor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {fornecedores?.map((fornecedor: any) => (
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

                    <FormField
                      control={form.control}
                      name="tipo_documento_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento</FormLabel>
                          <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                            <FormControl>
                              <SelectTrigger className={financeDetailFieldClassName}>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tiposDocumento?.map((tipo: any) => (
                                <SelectItem key={tipo.id} value={tipo.id.toString()}>
                                  {tipo.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="numero_documento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número do Documento</FormLabel>
                          <FormControl>
                          <Input className={financeDetailFieldClassName} placeholder="Digite o número do documento" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="data_emissao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Emissão</FormLabel>
                          <FormControl>
                            <DatePickerWithYearSelector
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Selecione a data"
                              triggerClassName={financeDetailFieldClassName}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_vencimento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Vencimento</FormLabel>
                          <FormControl>
                            <DatePickerWithYearSelector
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Selecione a data"
                              triggerClassName={financeDetailFieldClassName}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_competencia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Competência</FormLabel>
                          <FormControl>
                            <DatePickerWithYearSelector
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Selecione a data"
                              triggerClassName={financeDetailFieldClassName}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Digite observações sobre a conta"
                            className={`${financeDetailTextareaClassName} resize-none`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                      />
              </FinanceDetailSectionCard>
            </TabsContent>

            <TabsContent value="itens" className="space-y-4">
              <FinanceDetailSectionCard
                title="Itens do Documento"
                description="Organize os lançamentos com melhor leitura, densidade visual mais leve e total sempre visível."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addItem}
                    className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Item
                  </Button>
                }
              >
                  {itensFields.length > 0 ? (
                    <div className="space-y-4">
                      <div className={financeDetailTableWrapClassName}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto/Serviço</TableHead>
                            <TableHead>Quantidade</TableHead>
                            <TableHead>Valor Unitário</TableHead>
                            <TableHead>Valor Total</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itensFields.map((field, index) => (
                            <TableRow key={field.id}>
                              <TableCell className="w-[250px]">
                                <FormField
                                  control={form.control}
                                  name={`itens.${index}.produto_id`}
                                  render={({ field }) => (
                                    <Combobox
                                      value={field.value > 0 ? field.value.toString() : undefined}
                                      onValueChange={(value) => field.onChange(parseInt(value) || 0)}
                                      options={produtoOptions}
                                      className={financeDetailFieldClassName}
                                      placeholder="Selecionar produto/serviço"
                                      searchPlaceholder="Digite para buscar..."
                                      emptyText="Nenhum produto encontrado."
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`itens.${index}.quantidade`}
                                  render={({ field }) => (
                                    <Input
                                      className={financeDetailFieldClassName}
                                      type="number"
                                      step="0.001"
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(parseFloat(e.target.value) || 0);
                                        setTimeout(() => updateItemTotal(index), 0);
                                      }}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`itens.${index}.valor_unitario`}
                                  render={({ field }) => (
                                    <Input
                                      className={financeDetailFieldClassName}
                                      type="text"
                                      inputMode="decimal"
                                      name={field.name}
                                      ref={field.ref}
                                      defaultValue={field.value > 0 ? String(field.value).replace('.', ',') : ''}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(',', '.');
                                        field.onChange(parseFloat(raw) || 0);
                                        setTimeout(() => updateItemTotal(index), 0);
                                      }}
                                      onBlur={field.onBlur}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                {formatCurrency((watchedItens?.[index]?.quantidade || 0) * (watchedItens?.[index]?.valor_unitario || 0))}
                              </TableCell>
                              <TableCell>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)} className="rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                      <div className="flex justify-end">
                        <div className={`${financeDetailMutedPanelClassName} text-lg font-semibold text-slate-800`}>
                          Total: {formatCurrency(valorTotalItens)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                    </div>
                  )}
              </FinanceDetailSectionCard>
            </TabsContent>

            <TabsContent value="projetos" className="space-y-4">
              {/* Rateio por Projetos */}
              <FinanceDetailSectionCard
                title="Rateio por Projetos"
                description="Distribua a conta entre projetos com percentuais claros e feedback visual mais sofisticado."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addProjeto}
                    className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Projeto
                  </Button>
                }
              >
                  {projetosFields.length > 0 ? (
                    <div className="space-y-4">
                      <div className={financeDetailTableWrapClassName}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Projeto</TableHead>
                            <TableHead>Percentual (%)</TableHead>
                            <TableHead>Valor do Rateio</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projetosFields.map((field, index) => (
                            <TableRow key={field.id}>
                              <TableCell className="w-[200px]">
                                <FormField
                                  control={form.control}
                                      name={`projetos_rateio.${index}.projeto_id`}
                                      render={({ field }) => (
                                        <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                                      <SelectTrigger className={financeDetailFieldClassName}>
                                        <SelectValue placeholder="Selecionar" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {projetos?.map((projeto: any) => (
                                          <SelectItem key={projeto.id} value={projeto.id.toString()}>
                                            {projeto.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`projetos_rateio.${index}.percentual`}
                                  render={({ field }) => (
                                    <Input
                                      className={financeDetailFieldClassName}
                                      type="number"
                                      step="0.01"
                                      max="100"
                                      {...field}
                                      onChange={(e) => {
                                        field.onChange(parseFloat(e.target.value) || 0);
                                        setTimeout(() => updateProjetoRateio(index), 0);
                                      }}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                {formatCurrency(valorTotalItens * ((watchedProjetosRateio?.[index]?.percentual || 0) / 100))}
                              </TableCell>
                              <TableCell>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeProjeto(index)} className="rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                      <div className="flex justify-end space-x-4">
                        <div className={`text-lg font-semibold ${Math.abs(percentualTotalRateio - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                          Total: {percentualTotalRateio.toFixed(2)}% / 100%
                        </div>
                        {!rateioConfirmado && (
                          <Button 
                            type="button" 
                            onClick={handleSalvarRateio}
                            disabled={Math.abs(percentualTotalRateio - 100) > 0.01 || projetosFields.length === 0}
                            className="rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
                          >
                            <Calculator className="mr-2 h-4 w-4" />
                            SALVAR RATEIO
                          </Button>
                        )}
                        {rateioConfirmado && (
                          <Button 
                            type="button" 
                            variant="outline"
                            onClick={handleEditarRateio}
                            className="rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          >
                            Editar Rateio
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum projeto adicionado. Clique em "Adicionar Projeto" para começar.
                    </div>
                  )}
              </FinanceDetailSectionCard>

              {/* Alocação de Orçamentos por Projeto */}
              {rateioConfirmado && watchedProjetosRateio && watchedProjetosRateio.length > 0 && (
                <>
                  {watchedProjetosRateio.map((projetoRateio) => {
                    const projetoInfo = projetos?.find(p => p.id === projetoRateio.projeto_id);
                    return (
                      <ProjetoOrcamentoAlocacao
                        key={projetoRateio.projeto_id}
                        projetoId={projetoRateio.projeto_id}
                        projetoNome={projetoInfo?.name || 'Projeto não encontrado'}
                        valorRateio={getValorRateioProjeto(projetoRateio.projeto_id)}
                        alocacoes={orcamentosAlocacoes[projetoRateio.projeto_id] || {}}
                        onAlocacaoChange={(orcamentoId, valor) => handleOrcamentoAlocacaoChange(projetoRateio.projeto_id, orcamentoId, valor)}
                        isCompleta={isAlocacaoCompletaProjeto(projetoRateio.projeto_id)}
                        valorDisponivel={getValorDisponivelProjeto(projetoRateio.projeto_id)}
                        totalAlocado={getTotalAlocacoesByProjeto(projetoRateio.projeto_id)}
                        formatCurrency={formatCurrency}
                        projetoStatus={projetoInfo?.status}
                      />
                    );
                  })}
                  
                  {/* Resumo Geral das Alocações */}
                  <Card className={`${financeDetailCardClassName} border-blue-200`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Resumo Geral das Alocações
                        <Badge variant={isAlocacaoCompleta() ? "default" : "destructive"} className="text-xs">
                          {isAlocacaoCompleta() ? "Completo ✓" : "Pendente"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`grid grid-cols-3 gap-4 p-4 rounded-lg border-2 ${isAlocacaoCompleta() ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div>
                          <span className="text-sm font-medium">Valor Total da Conta:</span>
                          <div className="text-lg font-bold text-blue-600">{formatCurrency(valorTotalItens)}</div>
                          <p className="text-xs text-muted-foreground">Valor total a ser alocado</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Total Alocado:</span>
                          <div className={`text-lg font-bold ${isAlocacaoCompleta() ? 'text-green-600' : 'text-orange-600'}`}>
                            {formatCurrency(getTotalAlocacoes())}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {valorTotalItens > 0 ? ((getTotalAlocacoes() / valorTotalItens) * 100).toFixed(1) : 0}% do total
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Status Geral:</span>
                          <div className="flex items-center gap-2">
                            {isAlocacaoCompleta() ? (
                              <>
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium text-green-600">Completa</span>
                              </>
                            ) : (
                              <>
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-sm font-medium text-red-600">Incompleta</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Diferença: {formatCurrency(Math.abs(valorTotalItens - getTotalAlocacoes()))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="anexos" className="space-y-4">
              <FinanceDetailSectionCard
                title="Anexos e Documentos"
                description="Centralize comprovantes e documentos com uma apresentação mais limpa e menos pesada."
                contentClassName="space-y-4"
              >
                  {/* File upload section for new conta */}
                  {!isEditing && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Arquivos para Upload</h4>
                        <label htmlFor="file-upload-new-conta">
                          <Button variant="outline" size="sm" asChild className="rounded-xl border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                            <span className="cursor-pointer">
                              <Upload className="h-4 w-4 mr-2" />
                              Adicionar Arquivos
                            </span>
                          </Button>
                          <input
                            id="file-upload-new-conta"
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {pendingFiles.length > 0 ? (
                        <div className="space-y-2">
                          {pendingFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">{file.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {(file.size / 1024).toFixed(1)} KB
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removePendingFile(index)}
                                type="button"
                                className="rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum arquivo selecionado. Clique em "Adicionar Arquivos" para anexar documentos.
                        </div>
                      )}
                    </div>
                  )}

                  {/* FileManager for existing conta */}
                  {isEditing && contaPagarId && (
                    <FileManager
                      entityType="conta_pagar"
                      entityId={contaPagarId}
                      acceptedTypes="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      title="Documentos da Conta"
                    />
                  )}
              </FinanceDetailSectionCard>
            </TabsContent>

            <TabsContent value="pagamento" className="space-y-4">
              <FinanceDetailSectionCard
                title={isEditing ? 'Parcelas Cadastradas' : 'Configurações de Parcelamento'}
                description="Visualize e ajuste o parcelamento com mais clareza, melhor hierarquia e indicadores mais suaves."
                contentClassName="space-y-4"
              >
                  {!isEditing && (
                    <>
                      <FormField
                        control={form.control}
                        name="parcelas"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número de Parcelas</FormLabel>
                            <FormControl>
                              <Input
                                className={financeDetailFieldClassName}
                                type="number"
                                min="1"
                                max="360"
                                {...field}
                                onChange={(e) => {
                                  const numParcelas = parseInt(e.target.value) || 1;
                                  field.onChange(numParcelas);
                                  
                                  if (numParcelas > 1) {
                                    const dataVencimento = form.watch('data_vencimento') || new Date();
                                    const parcelas = [];
                                    for (let i = 0; i < numParcelas; i++) {
                                      const dataVencimentoParcela = new Date(dataVencimento);
                                      dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);
                                      
                                      parcelas.push({
                                        parcela: i + 1,
                                        data_vencimento: dataVencimentoParcela,
                                        valor: valorTotalItens / numParcelas,
                                      });
                                    }
                                    setParcelasPreview(parcelas);
                                  } else {
                                    setParcelasPreview([]);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className={financeDetailMutedPanelClassName}>
                        <h4 className="font-medium mb-2">Resumo do Parcelamento</h4>
                        <div className="space-y-1 text-sm">
                          <div>Valor total: {formatCurrency(valorTotalItens)}</div>
                          <div>Número de parcelas: {form.watch('parcelas')}</div>
                          <div>Valor por parcela: {formatCurrency(valorTotalItens / form.watch('parcelas'))}</div>
                        </div>
                      </div>

                      {parcelasPreview.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Detalhamento das Parcelas</h4>
                          <div className={financeDetailTableWrapClassName}>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[100px]">Parcela</TableHead>
                                  <TableHead>Data Vencimento</TableHead>
                                  <TableHead>Valor</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {parcelasPreview.map((parcela, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">
                                      {parcela.parcela}/{form.watch('parcelas')}
                                    </TableCell>
                                    <TableCell>
                                      <DatePickerWithYearSelector
                                        date={parcela.data_vencimento}
                                        onDateChange={(date) => {
                                          if (date) {
                                            const updatedParcelas = [...parcelasPreview];
                                            updatedParcelas[index].data_vencimento = date;
                                            setParcelasPreview(updatedParcelas);
                                          }
                                        }}
                                        placeholder="Selecione a data"
                                        triggerClassName={financeDetailFieldClassName}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        className={`${financeDetailFieldClassName} max-w-[150px]`}
                                        type="number"
                                        step="0.01"
                                        value={parcela.valor}
                                        onChange={(e) => {
                                          const updatedParcelas = [...parcelasPreview];
                                          updatedParcelas[index].valor = parseFloat(e.target.value) || 0;
                                          setParcelasPreview(updatedParcelas);
                                        }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="flex justify-end mt-2">
                            <div className={`text-sm font-semibold ${Math.abs(parcelasPreview.reduce((sum, p) => sum + p.valor, 0) - valorTotalItens) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                              Total das parcelas: {formatCurrency(parcelasPreview.reduce((sum, p) => sum + p.valor, 0))}
                            </div>
                          </div>
                        </div>
                      )}


                    </>
                  )}

                  {/* Exibir títulos existentes quando editando */}
                  {isEditing && existingTitulos && existingTitulos.length > 0 && (
                    <div className="space-y-4">
                      <div className={financeDetailMutedPanelClassName}>
                        <h4 className="font-medium mb-2">Resumo das Parcelas</h4>
                        <div className="space-y-1 text-sm">
                          <div>Valor total: {formatCurrency(valorTotalItens)}</div>
                          <div>Número de parcelas: {existingTitulos.length}</div>
                          <div>Valor médio por parcela: {formatCurrency(valorTotalItens / existingTitulos.length)}</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Parcelas e Datas de Vencimento</h4>
                        <div className={financeDetailTableWrapClassName}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Parcela</TableHead>
                              <TableHead>Data de Vencimento</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Valor Pago</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {existingTitulos.map((titulo: any) => (
                              <TableRow key={titulo.id}>
                                <TableCell>
                                  {titulo.parcela}/{titulo.total_parcelas}
                                </TableCell>
                                <TableCell>
                                  <DatePickerWithYearSelector
                                    date={titulosEditaveis[titulo.id] || parseLocalDate(titulo.data_vencimento)}
                                    onDateChange={(date) => {
                                      if (date) {
                                        setTitulosEditaveis(prev => ({
                                          ...prev,
                                          [titulo.id]: date
                                        }));
                                      }
                                    }}
                                    placeholder="Data de vencimento"
                                    disabled={titulo.status_calculado === 'pago'}
                                    triggerClassName={financeDetailFieldClassName}
                                  />
                                </TableCell>
                                <TableCell>{formatCurrency(parseFloat(titulo.valor))}</TableCell>
                                <TableCell>
                                  <Badge variant={
                                    titulo.status_calculado === 'pago' ? 'default' : 
                                    titulo.status_calculado === 'vencido' ? 'destructive' : 
                                    'secondary'
                                  }>
                                    {titulo.status_calculado === 'pago' ? 'Pago' : 
                                     titulo.status_calculado === 'vencido' ? 'Vencido' : 
                                     'Pendente'}
                                  </Badge>
                                  {titulo.status_calculado === 'pago' && titulo.data_pagamento && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Pago em: {new Date(titulo.data_pagamento).toLocaleDateString('pt-BR')}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {titulo.status_calculado === 'pago' && titulo.valor_pago ? (
                                    <span className="text-green-600 font-medium">
                                      {formatCurrency(parseFloat(titulo.valor_pago))}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {titulo.status_calculado !== 'pago' && titulosEditaveis[titulo.id] && 
                                   titulosEditaveis[titulo.id].getTime() !== new Date(titulo.data_vencimento).getTime() && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="rounded-xl border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                      onClick={async () => {
                                        try {
                                          console.log('Updating titulo:', titulo.id, 'with date:', titulosEditaveis[titulo.id]);
                                          await updateTituloPagar({
                                            id: titulo.id,
                                            dataVencimento: titulosEditaveis[titulo.id].toISOString().split('T')[0]
                                          });
                                          toast({
                                            title: "Data atualizada",
                                            description: `Parcela ${titulo.parcela} teve sua data de vencimento alterada para ${titulosEditaveis[titulo.id].toLocaleDateString('pt-BR')}`,
                                          });
                                          
                                          // Force component refresh by calling onSuccess
                                          onSuccess();
                                        } catch (error) {
                                          console.error('Error updating titulo:', error);
                                          toast({
                                            title: "Erro",
                                            description: `Não foi possível atualizar a data de vencimento. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    >
                                      Salvar Data
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>

                        {existingTitulos.some((titulo: any) => titulo.status_calculado !== 'pago') && (
                          <div className="mt-4 p-3 border rounded-lg bg-blue-50 border-blue-200">
                            <p className="text-sm text-blue-800">
                              <strong>Dica:</strong> Você pode ajustar as datas de vencimento das parcelas não pagas. 
                              Altere a data desejada e clique em "Salvar Data" para confirmar a alteração.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </FinanceDetailSectionCard>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  disabled={
                    isCreating ||
                    isUpdating ||
                    valorTotalItens === 0 ||
                    (projetosFields.length > 0 && Math.abs(percentualTotalRateio - 100) > 0.01) ||
                    (projetosFields.length > 0 && !isAlocacaoCompleta()) ||
                    (isEditing && conta.titulos_pagos > 0) ||
                    itensFields.length === 0
                  }
                  className="h-11 flex-1 rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing && conta.titulos_pagos > 0
                    ? 'Visualização'
                    : isEditing
                      ? (isUpdating ? 'Salvando...' : 'Salvar Alterações')
                      : (isCreating ? 'Salvando...' : 'Salvar Conta')
                  }
                </Button>
                {!isEditing && (
                  <Button
                    type="button"
                    disabled={
                      isCreating ||
                      isUpdating ||
                      valorTotalItens === 0 ||
                      (projetosFields.length > 0 && Math.abs(percentualTotalRateio - 100) > 0.01) ||
                      (projetosFields.length > 0 && !isAlocacaoCompleta()) ||
                      itensFields.length === 0
                    }
                    className="h-11 flex-1 rounded-xl bg-emerald-700 text-white shadow-sm hover:bg-emerald-600"
                    onClick={() => {
                      saveAndPayRef.current = true;
                      form.handleSubmit(onSubmit)();
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isCreating ? 'Salvando...' : 'Salvar e Baixar'}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={onCancel} className="h-11 rounded-xl border-slate-200 bg-white px-5 text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                  Cancelar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      {/* Save and Pay Modal */}
      <Dialog open={showSaveAndPayModal} onOpenChange={setShowSaveAndPayModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Efetuar Pagamento</DialogTitle>
          </DialogHeader>
          {contaIdParaPagamento && (
            <PaymentModalContent
              conta={{ id: contaIdParaPagamento }}
              contas={contas || []}
              onClose={() => setShowSaveAndPayModal(false)}
              onSuccess={() => {
                setShowSaveAndPayModal(false);
                onSuccess();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Efetuar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Conta para Pagamento</label>
              <Select value={paymentForm.conta_id} onValueChange={(value) => setPaymentForm({...paymentForm, conta_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas?.map((conta: any) => (
                    <SelectItem key={conta.id} value={conta.id.toString()}>
                      {conta.banco} - {conta.conta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Data do Pagamento</label>
              <DatePickerWithYearSelector
                date={paymentForm.data_pagamento}
                onDateChange={(date) => setPaymentForm({...paymentForm, data_pagamento: date || new Date()})}
                placeholder="Selecione a data"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Observações do Pagamento</label>
              <Textarea
                placeholder="Digite observações sobre o pagamento"
                value={paymentForm.observacoes}
                onChange={(e) => setPaymentForm({...paymentForm, observacoes: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Títulos para Pagamento</label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Pagar</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedTitulos.map((titulo, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedTitulos.includes(index)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTitulos([...selectedTitulos, index]);
                            } else {
                              setSelectedTitulos(selectedTitulos.filter(i => i !== index));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>{titulo.parcela}/{titulo.total_parcelas}</TableCell>
                      <TableCell>{titulo.data_vencimento.toLocaleDateString()}</TableCell>
                      <TableCell>{formatCurrency(titulo.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-2 text-sm text-muted-foreground">
                Total a pagar: {formatCurrency(selectedTitulos.reduce((total, index) => total + generatedTitulos[index].valor, 0))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={!paymentForm.conta_id || selectedTitulos.length === 0}>
              <CreditCard className="mr-2 h-4 w-4" />
              Efetuar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
