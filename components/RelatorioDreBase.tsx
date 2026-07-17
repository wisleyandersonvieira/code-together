'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadContasAction from '@/actions/loadContas';
import { MultiSelectIdFilter } from '@/components/ui/multi-select-filter';
import { DreDataLoader } from '@/components/DreDataLoader';
import {
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
} from '@/components/finance/listing-ui';


const TOOLTIP_CONTA_DESABILITADA = 'Disponível apenas para emissão por Data de Pagamento';

/** Status de projeto disponíveis para rateio (mesmos valores do cadastro). */
const STATUS_PROJETO_OPCOES = ['Em andamento', 'Concluído'] as const;

interface DreParams {
  estruturaId: number;
  matrizIds: number[];
  /** Vazio = todas as contas. Só se aplica quando tipoData === 'pagamento'. */
  contaIds: number[];
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
  /** Vazio = sem filtro de status (DRE idêntico ao atual). */
  statusProjeto: string[];
}

export interface RelatorioDreBaseProps {
  /**
   * Exibe o controle de status do projeto e repassa o filtro ao DreDataLoader.
   * Omitido/false → tela idêntica ao Relatório DRE atual (parâmetro sempre vazio).
   */
  showStatusFilter?: boolean;
  titulo?: string;
  descricao?: string;
}

/**
 * Corpo compartilhado do Relatório DRE. As telas "Relatório DRE" e "DRE por
 * Status" são wrappers finos deste componente — a única diferença é
 * `showStatusFilter`. Zero lógica de cálculo/export duplicada: tudo vive no
 * DreDataLoader e nas actions.
 */
export function RelatorioDreBase({
  showStatusFilter = false,
  titulo = 'Relatório DRE',
  descricao = 'Configure e gere o demonstrativo de resultado em um layout alinhado ao padrão premium do sistema.',
}: RelatorioDreBaseProps) {
  const { toast } = useToast();
  const [params, setParams] = useState<DreParams>({
    estruturaId: 0,
    matrizIds: [],
    contaIds: [],
    tipoData: 'competencia',
    dataInicio: '',
    dataFim: '',
    statusProjeto: [],
  });
  const [showReport, setShowReport] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load data for selects
  const [estruturas] = useLoadAction(loadEstruturasDreAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [contas] = useLoadAction(loadContasAction, []);

  const matrizOptions = (matrizes || []).map((m: any) => ({ id: Number(m.id), nome: m.nome }));
  // Conta corrente identificada por nome + banco, que é como o usuário a reconhece.
  const contaOptions = (contas || []).map((c: any) => ({
    id: Number(c.id),
    nome: c.banco ? `${c.nome} — ${c.banco}` : c.nome,
  }));

  const filtroContaHabilitado = params.tipoData === 'pagamento';



  const handleParamChange = (field: keyof DreParams, value: any) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const toggleStatus = (status: string) => {
    setParams((prev) => ({
      ...prev,
      statusProjeto: prev.statusProjeto.includes(status)
        ? prev.statusProjeto.filter((s) => s !== status)
        : [...prev.statusProjeto, status],
    }));
  };

  const generateDre = () => {
    if (!params.estruturaId || params.matrizIds.length === 0 || !params.dataInicio || !params.dataFim) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios e selecione ao menos uma matriz.',
        variant: 'destructive',
      });
      return;
    }

    setShowReport(true);
    setRefreshTrigger(prev => prev + 1);
  };



  return (
    <div className="space-y-6">
      <ListingPageHeader
        title={titulo}
        description={descricao}
      />

      <ListingFilterCard>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-700">Parâmetros do Relatório</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Estrutura DRE *</label>
                <Select
                  value={params.estruturaId.toString()}
                  onValueChange={(value) => handleParamChange('estruturaId', parseInt(value))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
                    <SelectValue placeholder="Selecione a estrutura" />
                  </SelectTrigger>
                  <SelectContent>
                    {estruturas?.map((estrutura: any) => (
                      <SelectItem key={estrutura.id} value={estrutura.id.toString()}>
                        {estrutura.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Matrizes *</label>
                <MultiSelectIdFilter
                  placeholder="Selecione as matrizes"
                  options={matrizOptions}
                  selected={params.matrizIds}
                  onChange={(ids) => handleParamChange('matrizIds', ids)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Emitir por *</label>
                <Select
                  value={params.tipoData}
                  onValueChange={(value) =>
                    setParams((prev) => ({
                      ...prev,
                      tipoData: value as DreParams['tipoData'],
                      // Filtro de conta não se aplica a competência: limpa para
                      // não sugerir um filtro que seria ignorado.
                      contaIds: value === 'pagamento' ? prev.contaIds : [],
                    }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competencia">Data de Competência</SelectItem>
                    <SelectItem value="pagamento">Data de Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${filtroContaHabilitado ? 'text-slate-700' : 'text-slate-400'}`}
                >
                  Conta Corrente
                </label>
                <MultiSelectIdFilter
                  placeholder="Todas as contas"
                  options={contaOptions}
                  selected={params.contaIds}
                  onChange={(ids) => handleParamChange('contaIds', ids)}
                  disabled={!filtroContaHabilitado}
                  title={filtroContaHabilitado ? undefined : TOOLTIP_CONTA_DESABILITADA}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Início *</label>
                <Input
                  type="date"
                  value={params.dataInicio}
                  onChange={(e) => handleParamChange('dataInicio', e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Fim *</label>
                <Input
                  type="date"
                  value={params.dataFim}
                  onChange={(e) => handleParamChange('dataFim', e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm"
                />
              </div>

              {showStatusFilter && (
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-slate-700">Status do Projeto</label>
                  <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    {STATUS_PROJETO_OPCOES.map((status) => (
                      <label
                        key={status}
                        htmlFor={`status-${status}`}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <Checkbox
                          id={`status-${status}`}
                          checked={params.statusProjeto.includes(status)}
                          onCheckedChange={() => toggleStatus(status)}
                        />
                        {status}
                      </label>
                    ))}
                    <span className="text-xs text-slate-400">
                      Sem seleção = todos os projetos (rateio integral).
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button className={listingPrimaryButtonClassName} onClick={generateDre}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar DRE
            </Button>
            {showReport && (
              <Button className={listingSecondaryButtonClassName} onClick={() => setShowReport(false)}>
                Ocultar Relatório
              </Button>
            )}
          </div>
        </div>
      </ListingFilterCard>

      {showReport && (
        <ListingTableCard>
          <CardHeader className="border-b border-slate-200/80 bg-slate-50/70">
            <CardTitle className="text-lg text-slate-900">Demonstrativo de Resultado do Exercício</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <DreDataLoader
              key={refreshTrigger}
              estruturaId={params.estruturaId}
              matrizIds={params.matrizIds}
              contaIds={params.contaIds}
              tipoData={params.tipoData}
              dataInicio={params.dataInicio}
              dataFim={params.dataFim}
              statusProjeto={showStatusFilter ? params.statusProjeto : undefined}
              refreshTrigger={refreshTrigger}
              onComplete={() => {
                toast({
                  title: 'Sucesso',
                  description: 'Relatório DRE gerado com sucesso.',
                });
              }}
            />
          </CardContent>
        </ListingTableCard>
      )}
    </div>
  );
}
