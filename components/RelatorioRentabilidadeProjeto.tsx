'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { AlertCircle, BarChart3, Calculator, FileSpreadsheet, FileText, Plus, Trash2, TrendingUp, Users } from 'lucide-react';

import loadProjetosAction from '@/actions/loadProjetos';
import loadProjetoMembersAction from '@/actions/loadProjetoMembers';
import loadProjetoRentabilidadeFluxosAction from '@/actions/loadProjetoRentabilidadeFluxos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import {
  computeProjectProfitabilityReport,
  formatPercent,
  getFutureFlowValidation,
  type FutureSimulatedFlowInput,
  type ProfitabilityReportResult,
  type ProfitabilityViewType,
  type ProjectMemberOption,
  type RealProjectFlow,
} from '@/utils/project-profitability';
import { exportProjectProfitabilityExcel, exportProjectProfitabilityPDF } from '@/utils/project-profitability-export';
import { formatDateForDisplay } from '@/utils/timezone';

type FutureFlowDraft = FutureSimulatedFlowInput;

function createEmptyFutureFlow(): FutureFlowDraft {
  return {
    id: `future-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    date: '',
    amount: 0,
    memberId: null,
    note: '',
  };
}

function SummaryCard({
  title,
  value,
  accentClassName = 'text-slate-900',
}: {
  title: string;
  value: string;
  accentClassName?: string;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <p className="text-sm text-slate-500">{title}</p>
        <p className={`mt-2 text-xl font-semibold ${accentClassName}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function RelatorioRentabilidadeProjeto() {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  const [projectId, setProjectId] = useState<string>('');
  const [viewType, setViewType] = useState<ProfitabilityViewType>('project_total');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [membersDropdownOpen, setMembersDropdownOpen] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [lucroLiquido, setLucroLiquido] = useState(0);
  const [futureFlows, setFutureFlows] = useState<FutureFlowDraft[]>([]);
  const [report, setReport] = useState<ProfitabilityReportResult | null>(null);
  const [inlineWarnings, setInlineWarnings] = useState<string[]>([]);

  const [projects] = useLoadAction(loadProjetosAction, []);
  const numericProjectId = projectId ? Number(projectId) : null;
  const [membersRaw] = useLoadAction(
    loadProjetoMembersAction,
    [],
    numericProjectId ? { projetoId: numericProjectId } : undefined,
  );
  const [realFlowsRaw] = useLoadAction(
    loadProjetoRentabilidadeFluxosAction,
    [],
    numericProjectId ? { projetoId: numericProjectId } : undefined,
  );

  const project = projects.find((item: any) => item.id === numericProjectId) ?? null;
  const members: ProjectMemberOption[] = (membersRaw || []).map((member: any) => ({
    id: Number(member.id),
    nome: member.nome,
    percentage: Number(member.percentage || 0),
  }));
  const realFlows: RealProjectFlow[] = (realFlowsRaw || []).map((flow: any) => ({
    ...flow,
    valor: Number(flow.valor || 0),
    percentage: Number(flow.percentage || 0),
  }));

  const firstHistoricalDate = realFlows.length > 0
    ? [...realFlows].sort((left, right) => String(left.data_fluxo).localeCompare(String(right.data_fluxo)))[0]?.data_fluxo
    : null;

  const resetResults = () => {
    setReport(null);
    setInlineWarnings([]);
  };

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds((current) => (
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId]
    ));
    resetResults();
  };

  const handleSelectAllMembers = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map((member) => member.id));
    }
    resetResults();
  };

  const getMembersTriggerLabel = () => {
    if (selectedMemberIds.length === 0) {
      return 'Selecione os membros';
    }
    if (selectedMemberIds.length === members.length) {
      return 'Todos os membros';
    }
    if (selectedMemberIds.length === 1) {
      return members.find((member) => member.id === selectedMemberIds[0])?.nome || '1 membro';
    }

    return `${selectedMemberIds.length} membros selecionados`;
  };

  const updateFutureFlow = (id: string, field: keyof FutureFlowDraft, value: string | number | null) => {
    setFutureFlows((current) => current.map((flow) => (
      flow.id === id ? { ...flow, [field]: value } : flow
    )));
    resetResults();
  };

  const addFutureFlow = () => {
    setFutureFlows((current) => [...current, createEmptyFutureFlow()]);
    resetResults();
  };

  const removeFutureFlow = (id: string) => {
    setFutureFlows((current) => current.filter((flow) => flow.id !== id));
    resetResults();
  };

  const validateAndBuildReport = () => {
    const errors: string[] = [];

    if (!numericProjectId || !project) {
      errors.push('Selecione um projeto.');
    }

    if (!exitDate) {
      errors.push('Informe a data final de saída.');
    }

    if (viewType === 'by_members' && selectedMemberIds.length === 0) {
      errors.push('Selecione ao menos um membro para a visualização por membros.');
    }

    const futureValidation = getFutureFlowValidation(
      futureFlows,
      viewType,
      selectedMemberIds,
      members,
      exitDate,
      firstHistoricalDate,
    );

    errors.push(...futureValidation.errors);

    if (errors.length > 0) {
      toast({
        title: 'Não foi possível gerar o relatório',
        description: errors[0],
        variant: 'destructive',
      });
      setInlineWarnings(futureValidation.warnings);
      return null;
    }

    const computedReport = computeProjectProfitabilityReport({
      projectName: project.name,
      viewType,
      selectedMemberIds,
      exitDate,
      lucroLiquido,
      realFlows,
      futureFlows,
      members,
    });

    if (!computedReport) {
      toast({
        title: 'Sem aportes',
        description: 'Não há aportes registrados ou simulados para os filtros selecionados.',
        variant: 'destructive',
      });
      setInlineWarnings(futureValidation.warnings);
      return null;
    }

    if (computedReport.totalInvestidoGeral === 0) {
      toast({
        title: 'Investimento zerado',
        description: 'O total investido geral é zero. Os indicadores não podem ser calculados.',
        variant: 'destructive',
      });
      setInlineWarnings(futureValidation.warnings);
      return null;
    }

    if (computedReport.diasTotal <= 0) {
      toast({
        title: 'Data inválida',
        description: 'A data final de saída deve ser maior que a primeira data de aporte considerada.',
        variant: 'destructive',
      });
      setInlineWarnings(futureValidation.warnings);
      return null;
    }

    const warnings = [...futureValidation.warnings, ...computedReport.warnings];
    setInlineWarnings(warnings);
    setReport(computedReport);
    return computedReport;
  };

  const handleGenerateReport = () => {
    const result = validateAndBuildReport();
    if (result) {
      toast({
        title: 'Relatório gerado',
        description: 'A rentabilidade do projeto foi calculada com sucesso.',
      });
    }
  };

  const handleExportExcel = () => {
    const result = report ?? validateAndBuildReport();
    if (!result) {
      return;
    }

    exportProjectProfitabilityExcel(result, {
      formatCurrency,
      formatPercent,
    });
  };

  const handleExportPDF = () => {
    const result = report ?? validateAndBuildReport();
    if (!result) {
      return;
    }

    exportProjectProfitabilityPDF(result, {
      formatCurrency,
      formatPercent,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            <TrendingUp className="h-6 w-6" />
            Rentabilidade do Projeto
          </h2>
          <p className="text-sm text-slate-500">
            Analise aportes reais e simulados para calcular rentabilidade simples, TIR anualizada e taxa equivalente total do período.
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" />
            Parâmetros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Projeto *</label>
              <Select
                value={projectId || 'selecione'}
                onValueChange={(value) => {
                  setProjectId(value === 'selecione' ? '' : value);
                  setSelectedMemberIds([]);
                  resetResults();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selecione">Selecione</SelectItem>
                  {(projects || []).map((item: any) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tipo de visualização *</label>
              <Select
                value={viewType}
                onValueChange={(value) => {
                  setViewType(value as ProfitabilityViewType);
                  resetResults();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_total">Projeto total</SelectItem>
                  <SelectItem value="by_members">Por membros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Membros do projeto</label>
              <Popover open={membersDropdownOpen} onOpenChange={setMembersDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal"
                    disabled={viewType !== 'by_members' || !numericProjectId}
                  >
                    {viewType === 'by_members' ? getMembersTriggerLabel() : 'Disponível apenas em "Por membros"'}
                    <Users className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <div className="border-b px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={handleSelectAllMembers} className="w-full justify-start">
                      {selectedMemberIds.length === members.length ? 'Limpar seleção' : 'Selecionar todos'}
                    </Button>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto p-3">
                    {members.length === 0 ? (
                      <p className="text-sm text-slate-500">Selecione um projeto para carregar os membros.</p>
                    ) : (
                      members.map((member) => (
                        <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                          <Checkbox
                            checked={selectedMemberIds.includes(member.id)}
                            onCheckedChange={() => handleToggleMember(member.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{member.nome}</div>
                            <div className="text-xs text-slate-500">{formatPercent(member.percentage / 100)}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Data final de saída *</label>
              <Input
                type="date"
                value={exitDate}
                onChange={(event) => {
                  setExitDate(event.target.value);
                  resetResults();
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Lucro líquido *</label>
              <CurrencyInput
                value={lucroLiquido}
                onValueChange={(value) => {
                  setLucroLiquido(value);
                  resetResults();
                }}
              />
              <p className="text-xs text-slate-500">O valor pode ser positivo ou negativo.</p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Aportes futuros simulados</h3>
                <p className="text-sm text-slate-500">
                  Esses lançamentos são usados apenas para simulação do relatório e não alteram os aportes reais do sistema.
                </p>
              </div>
              <Button onClick={addFutureFlow} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar aporte futuro
              </Button>
            </div>

            {futureFlows.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Nenhum aporte futuro adicionado.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data do aporte futuro</TableHead>
                      <TableHead>Valor do aporte futuro</TableHead>
                      <TableHead>Membro vinculado</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="w-[90px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {futureFlows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell>
                          <Input
                            type="date"
                            value={flow.date}
                            onChange={(event) => updateFutureFlow(flow.id, 'date', event.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <CurrencyInput
                            value={flow.amount}
                            onValueChange={(value) => updateFutureFlow(flow.id, 'amount', value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={flow.memberId ? String(flow.memberId) : 'none'}
                            onValueChange={(value) => updateFutureFlow(flow.id, 'memberId', value === 'none' ? null : Number(value))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Opcional" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {viewType === 'by_members' ? 'Selecione o membro' : 'Sem vínculo'}
                              </SelectItem>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={String(member.id)}>
                                  {member.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={flow.note}
                            onChange={(event) => updateFutureFlow(flow.id, 'note', event.target.value)}
                            placeholder="Observação opcional"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFutureFlow(flow.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerateReport}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Gerar relatório
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={!report}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={!report}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {inlineWarnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="space-y-2 p-4">
            {inlineWarnings.map((warning, index) => (
              <div key={`${warning}-${index}`} className="flex items-start gap-2 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Cabeçalho do Relatório</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">Projeto</p>
                <p className="font-semibold text-slate-900">{report.projectName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Tipo de visualização</p>
                <p className="font-semibold text-slate-900">
                  {report.viewType === 'project_total' ? 'Projeto total' : 'Por membros'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Membros selecionados</p>
                <p className="font-semibold text-slate-900">{report.selectedMemberNames.join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Data final de saída</p>
                <p className="font-semibold text-slate-900">{formatDateForDisplay(report.exitDate)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Lucro líquido informado</p>
                <p className="font-semibold text-slate-900">{formatCurrency(report.lucroLiquidoInformado)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Percentual total considerado</p>
                <p className="font-semibold text-slate-900">
                  {report.percentualTotalConsiderado === null ? '-' : formatPercent(report.percentualTotalConsiderado / 100)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Total investido real" value={formatCurrency(report.totalInvestidoReal)} />
            <SummaryCard title="Aportes futuros simulados" value={formatCurrency(report.totalAportesFuturos)} />
            <SummaryCard title="Total investido geral" value={formatCurrency(report.totalInvestidoGeral)} />
            <SummaryCard title="Lucro considerado" value={formatCurrency(report.lucroConsiderado)} accentClassName={report.lucroConsiderado >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            <SummaryCard title="Valor final de saída" value={formatCurrency(report.valorSaida)} accentClassName="text-blue-700" />
            <SummaryCard title="Rentabilidade simples" value={formatPercent(report.rentabilidadeSimples)} accentClassName={report.rentabilidadeSimples !== null && report.rentabilidadeSimples >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            <SummaryCard title="TIR anual (% a.a.)" value={formatPercent(report.tirAnual)} accentClassName="text-violet-700" />
            <SummaryCard title="Taxa equivalente total do período" value={formatPercent(report.taxaEquivalentePeriodo)} accentClassName="text-amber-700" />
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Tabela de Fluxos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[1120px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>% participação</TableHead>
                      <TableHead className="text-right">Valor do fluxo</TableHead>
                      <TableHead className="text-right">Dias até a saída</TableHead>
                      <TableHead className="text-right">Anos equivalentes</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.flows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell>{formatDateForDisplay(flow.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              flow.type === 'real_aporte'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : flow.type === 'future_aporte'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }
                          >
                            {flow.typeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>{flow.memberName || '-'}</TableCell>
                        <TableCell>
                          {flow.participationPercentage === null ? '-' : formatPercent(flow.participationPercentage / 100)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${flow.type === 'exit' ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {formatCurrency(flow.amount)}
                        </TableCell>
                        <TableCell className="text-right">{flow.daysToExit}</TableCell>
                        <TableCell className="text-right">{flow.equivalentYears.toFixed(4)}</TableCell>
                        <TableCell className="text-sm text-slate-500">{flow.observation || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-slate-50/60">
            <CardHeader>
              <CardTitle className="text-lg">Como o cálculo foi feito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>Rentabilidade simples = lucro considerado / total investido geral.</p>
              <p>TIR anual = taxa anual que zera o valor presente líquido dos fluxos de caixa.</p>
              <p>Taxa equivalente total = conversão da TIR anual para o prazo total da operação.</p>
              <p>Aportes futuros simulados foram incluídos no cálculo como fluxos projetados.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
