'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadProjetosAction from '@/actions/loadProjetos';
import loadContasAction from '@/actions/loadContas';
import { DreInfoDataLoader } from '@/components/DreInfoDataLoader';
import {
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
} from '@/components/finance/listing-ui';

interface DreInfoParams {
  estruturaId: number;
  matrizId: number;
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
  projetoId: number | null;
  contaId: number | null;
}

export function RelatorioDreInfo() {
  const { toast } = useToast();

  const [params, setParams] = useState<DreInfoParams>({
    estruturaId: 0,
    matrizId: 0,
    tipoData: 'competencia',
    dataInicio: '',
    dataFim: '',
    projetoId: null,
    contaId: null,
  });

  const [showReport, setShowReport] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Selects data ─────────────────────────────────────────────────────────────

  const [estruturas] = useLoadAction(loadEstruturasDreAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  const [projetos] = useLoadAction(loadProjetosAction, []);
  const [contas] = useLoadAction(loadContasAction, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const handleChange = <K extends keyof DreInfoParams>(field: K, value: DreInfoParams[K]) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  const projetoNome =
    params.projetoId
      ? (projetos as any[])?.find((p: any) => p.id === params.projetoId)?.name || undefined
      : undefined;

  const generateReport = () => {
    if (!params.estruturaId || !params.dataInicio || !params.dataFim) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha Estrutura DRE, Data Início e Data Fim.',
        variant: 'destructive',
      });
      return;
    }
    setShowReport(true);
    setRefreshTrigger((n) => n + 1);
  };

  const triggerClass = 'h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="DRE Info"
        description="Visualize o DRE com detalhamento dos lançamentos que compõem cada subgrupo."
      />

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <ListingFilterCard>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-700">Parâmetros do Relatório</div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Estrutura DRE */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Estrutura DRE *</label>
                <Select
                  value={params.estruturaId ? params.estruturaId.toString() : ''}
                  onValueChange={(v) => handleChange('estruturaId', parseInt(v))}
                >
                  <SelectTrigger className={triggerClass}>
                    <SelectValue placeholder="Selecione a estrutura" />
                  </SelectTrigger>
                  <SelectContent>
                    {(estruturas as any[])?.map((e: any) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Matriz */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Matriz *</label>
                <Select
                  value={params.matrizId !== null ? params.matrizId.toString() : 'todas'}
                  onValueChange={(v) => handleChange('matrizId', v === 'todas' ? 0 : parseInt(v))}
                >
                  <SelectTrigger className={triggerClass}>
                    <SelectValue placeholder="Selecione a matriz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as matrizes</SelectItem>
                    {(matrizes as any[])?.map((m: any) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Critério de Apuração */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Emitir por *</label>
                <Select
                  value={params.tipoData}
                  onValueChange={(v) => handleChange('tipoData', v as 'competencia' | 'pagamento')}
                >
                  <SelectTrigger className={triggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competencia">Data de Competência</SelectItem>
                    <SelectItem value="pagamento">Data de Pagamento / Recebimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data Início */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Início *</label>
                <Input
                  type="date"
                  value={params.dataInicio}
                  onChange={(e) => handleChange('dataInicio', e.target.value)}
                  className={triggerClass}
                />
              </div>

              {/* Data Fim */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Fim *</label>
                <Input
                  type="date"
                  value={params.dataFim}
                  onChange={(e) => handleChange('dataFim', e.target.value)}
                  className={triggerClass}
                />
              </div>

              {/* Projeto (opcional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Projeto{' '}
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Select
                  value={params.projetoId ? params.projetoId.toString() : 'todos'}
                  onValueChange={(v) => handleChange('projetoId', v === 'todos' ? null : parseInt(v))}
                >
                  <SelectTrigger className={triggerClass}>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os projetos</SelectItem>
                    {(projetos as any[])?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conta Corrente (opcional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Conta Corrente{' '}
                  <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Select
                  value={params.contaId ? params.contaId.toString() : 'todas'}
                  onValueChange={(v) => handleChange('contaId', v === 'todas' ? null : parseInt(v))}
                >
                  <SelectTrigger className={triggerClass}>
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as contas</SelectItem>
                    {(contas as any[])?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.nome}{c.banco ? ` - ${c.banco}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button className={listingPrimaryButtonClassName} onClick={generateReport}>
              <BarChart2 className="mr-2 h-4 w-4" />
              Gerar DRE Info
            </Button>
            {showReport && (
              <>
                <Button
                  variant="outline"
                  className={listingSecondaryButtonClassName}
                  onClick={generateReport}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
                <Button
                  variant="ghost"
                  className="text-slate-500"
                  onClick={() => setShowReport(false)}
                >
                  Ocultar Relatório
                </Button>
              </>
            )}
          </div>
        </div>
      </ListingFilterCard>

      {/* ── Report ───────────────────────────────────────────────────────────── */}
      {showReport && (
        <ListingTableCard>
          <CardHeader className="border-b border-slate-200/80 bg-slate-50/70">
            <CardTitle className="text-lg text-slate-900">
              DRE Info – Demonstrativo Analítico
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <DreInfoDataLoader
              key={refreshTrigger}
              estruturaId={params.estruturaId}
              matrizId={params.matrizId}
              tipoData={params.tipoData}
              dataInicio={params.dataInicio}
              dataFim={params.dataFim}
              projetoId={params.projetoId}
              contaId={params.contaId}
              projetoNome={projetoNome}
              refreshTrigger={refreshTrigger}
              onComplete={() => {
                toast({
                  title: 'DRE Info gerado',
                  description: 'Clique nas setas para expandir o detalhe dos lançamentos.',
                });
              }}
            />
          </CardContent>
        </ListingTableCard>
      )}
    </div>
  );
}
