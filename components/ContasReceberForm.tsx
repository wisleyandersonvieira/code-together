'use client';

import React, { useState, useMemo } from 'react';
import { validarPeriodoBloqueado } from '@/hooks/use-periodo-bloqueado';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileManager } from '@/components/FileManager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { Save, Plus, Trash2, CreditCard, Upload, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase } from '@/utils/timezone';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import {
  FinanceDetailSectionCard,
  financeDetailFieldClassName,
  financeDetailMutedPanelClassName,
  financeDetailTableWrapClassName,
  financeDetailTabsListClassName,
  financeDetailTabsTriggerClassName,
  financeDetailTextareaClassName,
} from '@/components/finance/detail-ui';
import loadClienteEntitiesAction from '@/actions/loadClienteEntities';
import loadTiposDocumentoAction from '@/actions/loadTiposDocumento';
import loadProdutosCreditoAction from '@/actions/loadProdutosCredito';
import loadProjetosAtivosAction from '@/actions/loadProjetosAtivos';
import { RateioAportesForm } from '@/components/RateioAportesForm';
import loadContasAction from '@/actions/loadContas';
import createContaReceberAction from '@/actions/createContaReceber';
import createContaReceberItemAction from '@/actions/createContaReceberItem';
import createContaReceberProjetoAction from '@/actions/createContaReceberProjeto';
import createTituloReceberSimpleAction from '@/actions/createTituloReceberSimple';
import receiveTituloReceberAction from '@/actions/receiveTituloReceber';
import saveRateioAportesAction from '@/actions/saveRateioAportes';
import createRateioAporteAction from '@/actions/createRateioAporte';
import uploadFileAction from '@/actions/uploadFile';
import updateContaReceberAction from '@/actions/updateContaReceber';
import updateTitulosReceberValorAction from '@/actions/updateTitulosReceberValor';
import loadContaReceberItensAction from '@/actions/loadContaReceberItens';
import loadContaReceberProjetosAction from '@/actions/loadContaReceberProjetos';
import deleteContaReceberItensAction from '@/actions/deleteContaReceberItens';
import deleteContaReceberProjetosAction from '@/actions/deleteContaReceberProjetos';
import loadMatrizesAction from '@/actions/loadMatrizes';
import createContaReceberFaturamentoAction from '@/actions/createContaReceberFaturamento';
import loadContaReceberFaturamentosAction from '@/actions/loadContaReceberFaturamentos';
import deleteContaReceberFaturamentosAction from '@/actions/deleteContaReceberFaturamentos';
import { ClienteForm } from '@/components/ClienteForm';
import { EmpresaForm } from '@/components/EmpresaForm';
import { GrupoForm } from '@/components/GrupoForm';

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

const projetoFaturamentoSchema = z.object({
  projeto_id: z.number().min(1, 'Projeto é obrigatório'),
  valor_faturamento: z.number().min(0.01, 'Valor deve ser maior que zero'),
  observacoes: z.string().optional(),
});

const formSchema = z.object({
  matriz_id: z.number().min(1, 'Matriz é obrigatória'),
  entity_type: z.string().min(1, 'Tipo de entidade é obrigatório'),
  entity_id: z.number().min(1, 'Cliente/Empresa/Grupo é obrigatório'),
  tipo_documento_id: z.number().min(1, 'Tipo de documento é obrigatório'),
  numero_documento: z.string().min(1, 'Número do documento é obrigatório'),
  data_emissao: z.date(),
  data_vencimento: z.date(),
  data_competencia: z.date(),
  observacoes: z.string().optional(),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
  projetos_rateio: z.array(projetoRateioSchema),
  projetos_faturamento: z.array(projetoFaturamentoSchema),
  parcelas: z.number().min(1, 'Número de parcelas deve ser maior que zero'),
});

interface ContasReceberFormProps {
  conta?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContasReceberForm({ conta, onSuccess, onCancel }: ContasReceberFormProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [generatedTitulos, setGeneratedTitulos] = useState<any[]>([]);
  const [selectedTitulos, setSelectedTitulos] = useState<number[]>([]);
  const [contaReceberId, setContaReceberId] = useState<number | null>(conta?.id || null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentRateiosMap, setCurrentRateiosMap] = useState<Record<number, any[]>>({});
  const [projetoActionType, setProjetoActionType] = useState<'rateio' | 'faturamento' | null>(null);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const entityIdsAntesDoCadastroRef = React.useRef<string[] | null>(null);
  const isEditing = !!conta;
  const [receiptForm, setReceiptForm] = useState({
    conta_id: '',
    data_recebimento: new Date(),
    observacoes: '',
  });
  const [parcelasPreview, setParcelasPreview] = useState<Array<{ parcela: number; data_vencimento: Date; valor: number }>>([]);

  // Data loading
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [clienteEntities, , , refreshClienteEntities] = useLoadAction(loadClienteEntitiesAction, []);
  const [tiposDocumento] = useLoadAction(loadTiposDocumentoAction, [], { searchDescricao: null });
  const [produtos] = useLoadAction(loadProdutosCreditoAction, []);
  const [projetos] = useLoadAction(loadProjetosAtivosAction, []);
  const projetosOrdenados = useMemo(() => {
    if (!projetos) return [];
    return [...projetos].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [projetos]);
  const [contas] = useLoadAction(loadContasAction, []);

  // Load existing items and projects when editing
  const [existingItens] = useLoadAction(loadContaReceberItensAction, [], { contaReceberId: conta?.id || null });
  const [existingProjetos] = useLoadAction(loadContaReceberProjetosAction, [], { contaReceberId: conta?.id || null });
  const [existingFaturamentos] = useLoadAction(loadContaReceberFaturamentosAction, [], { contaReceberId: conta?.id || null });

  // Mutations
  const [createContaReceber, isCreating] = useMutateAction(createContaReceberAction);
  const [updateContaReceber, isUpdating] = useMutateAction(updateContaReceberAction);
  const [createContaReceberItem] = useMutateAction(createContaReceberItemAction);
  const [createContaReceberProjeto] = useMutateAction(createContaReceberProjetoAction);
  const [deleteContaReceberItens] = useMutateAction(deleteContaReceberItensAction);
  const [deleteContaReceberProjetos] = useMutateAction(deleteContaReceberProjetosAction);
  const [createContaReceberFaturamento] = useMutateAction(createContaReceberFaturamentoAction);
  const [deleteContaReceberFaturamentos] = useMutateAction(deleteContaReceberFaturamentosAction);
  const [createTituloReceber] = useMutateAction(createTituloReceberSimpleAction);
  const [receiveTituloReceber] = useMutateAction(receiveTituloReceberAction);
  const [uploadFile] = useMutateAction(uploadFileAction);
  const [saveRateioAportes] = useMutateAction(saveRateioAportesAction);
  const [createRateioAporte] = useMutateAction(createRateioAporteAction);
  const [updateTitulosReceberValor] = useMutateAction(updateTitulosReceberValorAction);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      matriz_id: Number(conta?.matriz_id) || 0,
      entity_type: conta?.entity_type || 'cliente',
      entity_id: Number(conta?.entity_id || conta?.cliente_id) || 0,
      tipo_documento_id: Number(conta?.tipo_documento_id) || 0,
      numero_documento: conta?.numero_documento ? String(conta.numero_documento) : '',
      data_emissao: conta?.data_emissao ? new Date(conta.data_emissao) : new Date(),
      data_vencimento: conta?.data_vencimento ? new Date(conta.data_vencimento) : new Date(),
      data_competencia: conta?.data_competencia ? new Date(conta.data_competencia) : new Date(),
      observacoes: conta?.observacoes ? String(conta.observacoes) : '',
      itens: [],
      projetos_rateio: [],
      projetos_faturamento: [],
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

  const { fields: faturamentosFields, append: appendFaturamento, remove: removeFaturamento } = useFieldArray({
    control: form.control,
    name: 'projetos_faturamento',
  });

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
      setProjetoActionType('rateio');
    }
  }, [existingProjetos, isEditing, projetosFields.length, appendProjeto]);

  React.useEffect(() => {
    if (isEditing && existingFaturamentos && existingFaturamentos.length > 0 && faturamentosFields.length === 0) {
      // Add faturamentos from database
      existingFaturamentos.forEach((faturamento: any) => {
        appendFaturamento({
          projeto_id: faturamento.projeto_id,
          valor_faturamento: parseFloat(faturamento.valor_faturamento) || 0,
          observacoes: faturamento.observacoes || '',
        });
      });
      setProjetoActionType('faturamento');
    }
  }, [existingFaturamentos, isEditing, faturamentosFields.length, appendFaturamento]);

  const watchedItens = form.watch('itens') || [];
  const watchedProjetosRateio = form.watch('projetos_rateio') || [];
  const watchedProjetosFaturamento = form.watch('projetos_faturamento') || [];
  const watchedEntityType = form.watch('entity_type');

  // Entidades do tipo selecionado (cliente/empresa/grupo), ordenadas alfabeticamente
  const entityOptions = React.useMemo(() => {
    if (!clienteEntities || !watchedEntityType) return [];
    return clienteEntities
      .filter((entity: any) => entity.entity_type === watchedEntityType)
      .map((entity: any) => ({
        value: entity.id.toString(),
        label: entity.name || '',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [clienteEntities, watchedEntityType]);

  const entityLabel =
    watchedEntityType === 'cliente' ? 'Cliente' : watchedEntityType === 'empresa' ? 'Empresa' : 'Grupo';

  const getEntityKey = (entity: any) => `${entity.entity_type}-${entity.id}`;

  const handleOpenEntityModal = () => {
    // Guarda as entidades atuais para identificar a que for criada após o refresh
    entityIdsAntesDoCadastroRef.current = (clienteEntities || []).map(getEntityKey);
    setShowEntityModal(true);
  };

  const handleEntityCriada = () => {
    setShowEntityModal(false);
    refreshClienteEntities();
  };

  // Seleciona automaticamente a entidade recém-cadastrada quando a lista é recarregada
  React.useEffect(() => {
    const chavesAnteriores = entityIdsAntesDoCadastroRef.current;
    if (!chavesAnteriores || !clienteEntities) return;

    const novaEntidade = clienteEntities.find(
      (entity: any) => entity.entity_type === watchedEntityType && !chavesAnteriores.includes(getEntityKey(entity)),
    );
    if (novaEntidade) {
      entityIdsAntesDoCadastroRef.current = null;
      form.setValue('entity_id', Number(novaEntidade.id), { shouldValidate: true });
    }
  }, [clienteEntities, watchedEntityType, form]);

  // Calculate totals
  const valorTotalItens = watchedItens.reduce((total, item) => {
    const quantidade = item.quantidade || 0;
    const valorUnitario = item.valor_unitario || 0;
    return total + (quantidade * valorUnitario);
  }, 0);

  const percentualTotalRateio = watchedProjetosRateio.reduce((total, projeto) => {
    return total + (projeto.percentual || 0);
  }, 0);

  const valorTotalFaturamento = watchedProjetosFaturamento.reduce((total, projeto) => {
    return total + (projeto.valor_faturamento || 0);
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
    setProjetoActionType('rateio');
  };

  const addFaturamento = () => {
    appendFaturamento({
      projeto_id: 0,
      valor_faturamento: 0,
      observacoes: '',
    });
    setProjetoActionType('faturamento');
  };

  const updateItemTotal = (index: number) => {
    const item = watchedItens[index];
    if (item) {
      const total = (item.quantidade || 0) * (item.valor_unitario || 0);
      form.setValue(`itens.${index}.valor_total`, total);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (Object.keys(form.formState.errors).length > 0) {
      return;
    }

    await saveContaAndRateio(values, false);
  };

  const updateProjetoRateio = (index: number) => {
    const projeto = watchedProjetosRateio[index];
    if (projeto && valorTotalItens > 0) {
      const valorRateio = valorTotalItens * (projeto.percentual / 100);
      form.setValue(`projetos_rateio.${index}.valor_rateio`, valorRateio);
    }
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

  const uploadPendingFiles = async (contaReceberId: number) => {
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
          entityType: 'conta_receber',
          entityId: contaReceberId,
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

  const saveContaAndRateio = async (values: z.infer<typeof formSchema>, saveRateioAfter: boolean = false) => {
    // If editing and has receipts, don't allow saving
    if (isEditing && conta.titulos_recebidos > 0) {
      toast({
        title: "Não é possível editar",
        description: "Esta conta possui recebimentos efetuados e não pode ser modificada.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

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

      // Validation - only check project percentages if there are projects
      if (values.projetos_rateio.length > 0 && Math.abs(percentualTotalRateio - 100) > 0.01) {
        toast({
          title: "Erro de validação",
          description: "O total do rateio deve ser exatamente 100%",
          variant: "destructive",
        });
        return;
      }

      // Validation - check faturamento values if there are faturamentos
      if (values.projetos_faturamento.length > 0 && Math.abs(valorTotalFaturamento - valorTotalItens) > 0.01) {
        toast({
          title: "Erro de validação",
          description: "O total do faturamento deve ser igual ao valor total dos itens",
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

      let currentContaReceberId: number;

      if (isEditing) {
        // Update existing conta a receber
        await updateContaReceber({
          id: conta.id,
          matriz_id: values.matriz_id,
          cliente_id: values.entity_type === 'cliente' ? values.entity_id : null,
          entity_type: values.entity_type,
          entity_id: values.entity_id,
          tipo_documento_id: values.tipo_documento_id,
          numero_documento: values.numero_documento,
          data_emissao: formatDateForDatabase(values.data_emissao),
          data_vencimento: formatDateForDatabase(values.data_vencimento),
          data_competencia: formatDateForDatabase(values.data_competencia),
          observacoes: values.observacoes,
          valor_total: valorTotalItens,
        });

        currentContaReceberId = conta.id;

        // Update pending títulos values if valor_total changed
        const antigoValorTotal = parseFloat(conta.valor_total);
        if (antigoValorTotal && antigoValorTotal !== valorTotalItens) {
          await updateTitulosReceberValor({
            conta_receber_id: conta.id,
            antigo_valor_total: antigoValorTotal,
            novo_valor_total: valorTotalItens,
          });
        }

        // Delete existing items, projects, and faturamentos
        await Promise.all([
          deleteContaReceberItens({ contaReceberId: conta.id }),
          deleteContaReceberProjetos({ contaReceberId: conta.id }),
          deleteContaReceberFaturamentos({ contaReceberId: conta.id }),
        ]);
      } else {
        // Create new conta a receber
        const contaReceberResult = await createContaReceber({
          matriz_id: values.matriz_id,
          cliente_id: values.entity_type === 'cliente' ? values.entity_id : null,
          entity_type: values.entity_type,
          entity_id: values.entity_id,
          tipo_documento_id: values.tipo_documento_id,
          numero_documento: values.numero_documento,
          data_emissao: formatDateForDatabase(values.data_emissao),
          data_vencimento: formatDateForDatabase(values.data_vencimento),
          data_competencia: formatDateForDatabase(values.data_competencia),
          observacoes: values.observacoes,
          valor_total: valorTotalItens,
        });

        currentContaReceberId = contaReceberResult[0].id;
        setContaReceberId(currentContaReceberId);
      }

      // Create/recreate items
      const itensPromises = values.itens.map((item) =>
        createContaReceberItem({
          conta_receber_id: currentContaReceberId,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.quantidade * item.valor_unitario,
        }),
      );

      // Create/recreate project allocations (only if there are projects)
      const projetosPromises = values.projetos_rateio.map((projeto) =>
        createContaReceberProjeto({
          conta_receber_id: currentContaReceberId,
          projeto_id: projeto.projeto_id,
          percentual: projeto.percentual,
          valor_rateio: valorTotalItens * (projeto.percentual / 100),
        }),
      );

      // Create/recreate faturamentos (only if there are faturamentos)
      const faturamentosPromises = values.projetos_faturamento.map((faturamento) =>
        createContaReceberFaturamento({
          contaReceberId: currentContaReceberId,
          projetoId: faturamento.projeto_id,
          valorFaturamento: faturamento.valor_faturamento,
          observacoes: faturamento.observacoes || '',
        }),
      );

      await Promise.all([...itensPromises, ...projetosPromises, ...faturamentosPromises]);

      // Auto-save rateio data if there are rateios with values
      const allRateios = Object.values(currentRateiosMap).flat();
      if (allRateios && allRateios.length > 0) {
        const rateiosComValor = allRateios.filter(r => r.valor_rateado > 0);
        if (rateiosComValor.length > 0) {
          try {
            // First delete existing rateios for this conta (sequencial: limpa antes de recriar)
            await saveRateioAportes({
              contaReceberId: currentContaReceberId
            });

            // Then create new rateio entries for non-zero values
            await Promise.all(
              rateiosComValor.map((rateio) =>
                createRateioAporte({
                  contaReceberId: currentContaReceberId,
                  aporteId: rateio.aporte_id,
                  valorRateado: rateio.valor_rateado
                }),
              ),
            );

            if (saveRateioAfter) {
              toast({
                title: "Sucesso",
                description: "Conta a receber e rateio salvos com sucesso!",
              });
            }
          } catch (error) {
            console.error('Erro ao salvar rateio automaticamente:', error);
            if (saveRateioAfter) {
              toast({
                title: "Atenção", 
                description: "Conta salva, mas houve erro ao salvar o rateio. Tente salvar o rateio novamente.",
                variant: "destructive",
              });
            }
          }
        } else if (saveRateioAfter) {
          // Just delete existing rateios if no values to save
          try {
            await saveRateioAportes({
              contaReceberId: currentContaReceberId
            });
          } catch (error) {
            console.error('Erro ao limpar rateios:', error);
          }
        }
      }

      if (!isEditing) {
        // Generate parcelas/títulos only for new accounts
        const parcelas = parcelasPreview.length > 0
          ? parcelasPreview.map((p) => ({ ...p, total_parcelas: values.parcelas }))
          : generateParcelas(values.data_vencimento, values.parcelas, valorTotalItens);

        // Promise.all preserva a ordem do array de entrada, mantendo a ordem das parcelas
        const titulosResults = await Promise.all(
          parcelas.map((parcela) =>
            createTituloReceber({
              conta_receber_id: currentContaReceberId,
              parcela: parcela.parcela,
              total_parcelas: parcela.total_parcelas,
              data_vencimento: formatDateForDatabase(parcela.data_vencimento),
              valor: parcela.valor,
            }),
          ),
        );
        const titulosGerados = parcelas.map((parcela, index) => ({
          ...parcela,
          id: titulosResults[index]?.[0]?.id,
        }));
        setGeneratedTitulos(titulosGerados);

        // Upload pending files
        if (pendingFiles.length > 0) {
          await uploadPendingFiles(currentContaReceberId);
        }

        if (!saveRateioAfter) {
          toast({
            title: "Conta a receber criada",
            description: `Conta criada com ${values.parcelas} título(s) gerado(s)${pendingFiles.length > 0 ? ` e ${pendingFiles.length} arquivo(s) anexado(s)` : ''}`,
          });
        }
        onSuccess();
      } else {
        if (!saveRateioAfter) {
          toast({
            title: "Conta a receber atualizada",
            description: "Conta atualizada com sucesso.",
          });
        }
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving conta a receber:', error);
      toast({
        title: "Erro",
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} a conta a receber. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReceipt = async () => {
    // Validar período bloqueado para pagamento/recebimento
    const validacao = await validarPeriodoBloqueado({
      matrizId: conta?.matriz_id,
      dataPagamento: receiptForm.data_recebimento,
    });
    if (validacao.bloqueado) {
      toast({ title: 'Período Bloqueado', description: validacao.mensagem, variant: 'destructive' });
      return;
    }

    try {
      await Promise.all(
        selectedTitulos.map((index) => {
          const titulo = generatedTitulos[index];
          return receiveTituloReceber({
            id: titulo.id,
            valor_recebido: titulo.valor,
            data_recebimento: receiptForm.data_recebimento.toISOString().split('T')[0],
            conta_id: parseInt(receiptForm.conta_id),
            observacoes_recebimento: receiptForm.observacoes,
          });
        }),
      );

      toast({
        title: "Recebimento realizado",
        description: `${selectedTitulos.length} título(s) recebido(s) com sucesso`,
      });
      onSuccess();
    } catch (error) {
      console.error('Error receiving títulos:', error);
      toast({
        title: "Erro no recebimento",
        description: "Não foi possível realizar o recebimento",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-9 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, () => {
          toast({
            title: "Erro de validação",
            description: "Por favor, verifique os campos obrigatórios.",
            variant: "destructive",
          });
        })} className="space-y-6 [&_label]:text-[0.82rem] [&_label]:font-semibold [&_label]:tracking-[0.01em] [&_label]:text-slate-600">
          <Tabs defaultValue="geral" className="space-y-6">
            <TabsList className={financeDetailTabsListClassName}>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="geral">Dados Gerais</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="itens">Itens</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="projetos">Projetos</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="anexos">Anexos</TabsTrigger>
              <TabsTrigger className={financeDetailTabsTriggerClassName} value="recebimento">Parcelamento</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4">
              <FinanceDetailSectionCard
                title="Informações Gerais"
                description="Concentre os dados principais da receita em um layout mais leve, moderno e corporativo."
                contentClassName="space-y-5"
              >
                  <FormField
                    control={form.control}
                    name="matriz_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Matriz *</FormLabel>
                        <Select
                          value={field.value > 0 ? field.value.toString() : ''}
                          onValueChange={(value) => field.onChange(parseInt(value) || 0)}
                        >
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
                      name="entity_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Entidade</FormLabel>
                          <Select 
                            value={field.value} 
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Reset entity_id when type changes
                              form.setValue('entity_id', 0);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className={financeDetailFieldClassName}>
                                <SelectValue placeholder="Selecione o tipo" />
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
                      name="entity_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{entityLabel}</FormLabel>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <FormControl>
                                <Combobox
                                  value={field.value > 0 ? field.value.toString() : undefined}
                                  onValueChange={(value) => field.onChange(parseInt(value) || 0)}
                                  options={entityOptions}
                                  disabled={!watchedEntityType}
                                  className={financeDetailFieldClassName}
                                  placeholder={`Selecione ${watchedEntityType || 'a entidade'}`}
                                  searchPlaceholder={`Buscar ${watchedEntityType || 'entidade'}...`}
                                  emptyText="Nenhum resultado encontrado"
                                />
                              </FormControl>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={!watchedEntityType}
                              title={`Cadastrar ${watchedEntityType || 'entidade'}`}
                              onClick={handleOpenEntityModal}
                              className="h-10 w-10 shrink-0 rounded-xl border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
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
                          <Select
                            value={field.value > 0 ? field.value.toString() : ''}
                            onValueChange={(value) => field.onChange(parseInt(value) || 0)}
                          >
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
                description="Mantenha os itens bem distribuídos, com leitura mais suave e total consolidado em destaque."
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
                              <TableCell className="w-[200px]">
                                <FormField
                                  control={form.control}
                                      name={`itens.${index}.produto_id`}
                                      render={({ field }) => (
                                        <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                                      <SelectTrigger className={financeDetailFieldClassName}>
                                        <SelectValue placeholder="Selecionar" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {produtos?.map((produto: any) => (
                                          <SelectItem key={produto.id} value={produto.id.toString()}>
                                            {produto.descricao}
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
                                {formatCurrency((watchedItens[index]?.quantidade || 0) * (watchedItens[index]?.valor_unitario || 0))}
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
              <FinanceDetailSectionCard
                title="Projetos"
                description="Escolha entre rateio percentual ou faturamento por projeto com feedback mais claro e visual mais refinado."
                action={
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={addProjeto}
                      disabled={projetoActionType === 'faturamento'}
                      className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Projeto
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={addFaturamento}
                      disabled={projetoActionType === 'rateio'}
                      className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Faturamento
                    </Button>
                  </div>
                }
              >
                  {projetoActionType === null && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-4">Escolha uma das opções acima para começar:</p>
                      <div className="space-y-2 text-sm">
                        <p><strong>Adicionar Projeto:</strong> Para fazer rateio por percentual entre projetos</p>
                        <p><strong>Adicionar Faturamento:</strong> Para especificar valores fixos de faturamento por projeto</p>
                      </div>
                    </div>
                  )}

                  {projetoActionType === 'rateio' && (
                    <>
                      {projetosFields.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="secondary">Modo: Rateio por Projetos</Badge>
                          </div>
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
                                    {formatCurrency(valorTotalItens * ((watchedProjetosRateio[index]?.percentual || 0) / 100))}
                                  </TableCell>
                                  <TableCell>
                                    <Button type="button" variant="ghost" size="sm" className="rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => {
                                      removeProjeto(index);
                                      if (projetosFields.length === 1) {
                                        setProjetoActionType(null);
                                      }
                                    }}>
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
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum projeto adicionado. Clique em "Adicionar Projeto" para começar o rateio.
                        </div>
                      )}
                    </>
                  )}

                  {projetoActionType === 'faturamento' && (
                    <>
                      {faturamentosFields.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="secondary">Modo: Faturamento por Projetos</Badge>
                          </div>
                          <div className={financeDetailTableWrapClassName}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Projeto</TableHead>
                                <TableHead>Valor do Faturamento</TableHead>
                                <TableHead>Observações</TableHead>
                                <TableHead>Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {faturamentosFields.map((field, index) => (
                                <TableRow key={field.id}>
                                  <TableCell className="w-[200px]">
                                    <FormField
                                      control={form.control}
                                      name={`projetos_faturamento.${index}.projeto_id`}
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
                                      name={`projetos_faturamento.${index}.valor_faturamento`}
                                      render={({ field }) => (
                                        <Input
                                          className={financeDetailFieldClassName}
                                          type="number"
                                          step="0.01"
                                          placeholder="0,00"
                                          {...field}
                                          onChange={(e) => {
                                            field.onChange(parseFloat(e.target.value) || 0);
                                          }}
                                        />
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <FormField
                                      control={form.control}
                                      name={`projetos_faturamento.${index}.observacoes`}
                                      render={({ field }) => (
                                        <Input
                                          className={financeDetailFieldClassName}
                                          placeholder="Observações opcionais"
                                          {...field}
                                        />
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button type="button" variant="ghost" size="sm" className="rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => {
                                      removeFaturamento(index);
                                      if (faturamentosFields.length === 1) {
                                        setProjetoActionType(null);
                                      }
                                    }}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          </div>
                          <div className="flex justify-end space-x-4">
                            <div className={`text-lg font-semibold ${Math.abs(valorTotalFaturamento - valorTotalItens) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                              Total Faturado: {formatCurrency(valorTotalFaturamento)} / {formatCurrency(valorTotalItens)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum faturamento adicionado. Clique em "Adicionar Faturamento" para começar.
                        </div>
                      )}
                    </>
                  )}
              </FinanceDetailSectionCard>

              {/* Rateio de Aportes para cada projeto */}
              {projetosFields.length > 0 && form.watch('entity_type') && form.watch('entity_id') && (
                watchedProjetosRateio.map((projetoRateio, index) => {
                  if (!projetoRateio?.projeto_id) return null;
                  const projetoNome = projetos?.find((p: any) => p.id === projetoRateio.projeto_id)?.name;
                  return (
                    <div key={`rateio-${projetoRateio.projeto_id}-${index}`} className="space-y-2">
                      {projetosFields.length > 1 && (
                        <h3 className="text-sm font-semibold text-muted-foreground">
                          Rateio do Projeto: {projetoNome || `Projeto ${projetoRateio.projeto_id}`}
                        </h3>
                      )}
                      <RateioAportesForm
                        projetoId={projetoRateio.projeto_id}
                        entityType={form.watch('entity_type') as 'cliente' | 'empresa' | 'grupo'}
                        entityId={form.watch('entity_id') || 0}
                        valorTotal={valorTotalItens * ((projetoRateio.percentual || 0) / 100)}
                        onRateioChange={(rateios) => {
                          setCurrentRateiosMap(prev => ({
                            ...prev,
                            [projetoRateio.projeto_id]: rateios,
                          }));
                        }}
                        disabled={isEditing && conta.titulos_recebidos > 0}
                        contaReceberId={contaReceberId}
                      />
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="anexos" className="space-y-4">
              <FinanceDetailSectionCard
                title="Anexos e Documentos"
                description="Reúna arquivos e comprovantes em um bloco mais limpo, arejado e coerente com a navegação."
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
                  {isEditing && contaReceberId && (
                    <FileManager
                      entityType="conta_receber"
                      entityId={contaReceberId}
                      acceptedTypes="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      title="Documentos da Conta"
                    />
                  )}
              </FinanceDetailSectionCard>
            </TabsContent>

            <TabsContent value="recebimento" className="space-y-4">
              <FinanceDetailSectionCard
                title="Configurações de Parcelamento"
                description="Configure parcelas e datas com uma composição mais suave, legível e alinhada ao padrão premium."
                contentClassName="space-y-4"
              >
                  {!isEditing && (
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
                  )}

                  <div className={financeDetailMutedPanelClassName}>
                    <h4 className="font-medium mb-2">Resumo do Parcelamento</h4>
                    <div className="space-y-1 text-sm">
                      <div>Valor total: {formatCurrency(valorTotalItens)}</div>
                      <div>Número de parcelas: {form.watch('parcelas')}</div>
                      <div>Valor por parcela: {formatCurrency(valorTotalItens / form.watch('parcelas'))}</div>
                    </div>
                  </div>

                  {!isEditing && parcelasPreview.length > 0 && (
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

              </FinanceDetailSectionCard>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={
                      isSaving ||
                      isCreating ||
                      isUpdating ||
                      valorTotalItens === 0 ||
                      (projetosFields.length > 0 && Math.abs(percentualTotalRateio - 100) > 0.01) ||
                      (faturamentosFields.length > 0 && Math.abs(valorTotalFaturamento - valorTotalItens) > 0.01) ||
                      itensFields.length === 0 ||
                      (isEditing && conta?.titulos_recebidos > 0)
                    }
                    className="h-11 flex-1 rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isEditing && conta?.titulos_recebidos > 0
                      ? 'Visualização'
                      : isEditing
                        ? (isSaving ? 'Salvando...' : 'Salvar Alterações')
                        : (isSaving ? 'Salvando...' : 'Salvar Conta')
                    }
                  </Button>
                  <Button type="button" variant="outline" onClick={onCancel} className="h-11 rounded-xl border-slate-200 bg-white px-5 text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    Cancelar
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      {/* Cadastro rápido da entidade (cliente/empresa/grupo) */}
      <Dialog open={showEntityModal} onOpenChange={setShowEntityModal}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo {entityLabel}</DialogTitle>
          </DialogHeader>
          {watchedEntityType === 'cliente' && (
            <ClienteForm
              modalMode={true}
              onSuccess={handleEntityCriada}
              onCancel={() => setShowEntityModal(false)}
            />
          )}
          {watchedEntityType === 'empresa' && (
            <EmpresaForm
              onSuccess={handleEntityCriada}
              onCancel={() => setShowEntityModal(false)}
            />
          )}
          {watchedEntityType === 'grupo' && (
            <GrupoForm
              onSuccess={handleEntityCriada}
              onCancel={() => setShowEntityModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Efetuar Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Conta para Recebimento</label>
              <Select value={receiptForm.conta_id} onValueChange={(value) => setReceiptForm({...receiptForm, conta_id: value})}>
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
              <label className="text-sm font-medium mb-1 block">Data do Recebimento</label>
              <DatePickerWithYearSelector
                date={receiptForm.data_recebimento}
                onDateChange={(date) => setReceiptForm({...receiptForm, data_recebimento: date || new Date()})}
                placeholder="Selecione a data"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Observações do Recebimento</label>
              <Textarea
                placeholder="Digite observações sobre o recebimento"
                value={receiptForm.observacoes}
                onChange={(e) => setReceiptForm({...receiptForm, observacoes: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Títulos para Recebimento</label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Receber</TableHead>
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
                Total a receber: {formatCurrency(selectedTitulos.reduce((total, index) => total + generatedTitulos[index].valor, 0))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReceipt} disabled={!receiptForm.conta_id || selectedTitulos.length === 0}>
              <CreditCard className="mr-2 h-4 w-4" />
              Efetuar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
