'use client';

import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Calendar, ChevronDown, FileDown, FileText, X } from 'lucide-react';

import loadContasAction from '@/actions/loadContas';
import loadExtratoAction from '@/actions/loadExtrato';
import loadExtratoByGrupoAction from '@/actions/loadExtratoByGrupoContabil';
import loadExtratoBySubgrupoAction from '@/actions/loadExtratoBySubgrupoContabil';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadSaldoAnteriorAction from '@/actions/loadSaldoAnterior';
import {
  FinanceStatusBadge,
  ListingEmptyState,
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
  listingTableCellClassName,
  listingTableHeadClassName,
} from '@/components/finance/listing-ui';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase, formatDateForDisplay } from '@/utils/timezone';
import { exportExtratoBancarioPDF } from '@/utils/export';

type TipoMovimentacao = 'CP' | 'CR' | 'TR' | 'APORTE' | 'RETIRADA';

interface ExtratoTransaction {
  data: string;
  fornecedor_creditor: string;
  numero_documento?: string;
  projeto?: string;
  valor: number;
  tipo: TipoMovimentacao;
  matriz_nome?: string;
  observacoes?: string;
}

interface TransacaoComSaldo extends ExtratoTransaction {
  saldo_linha: number;
  entrada: number;
  saida: number;
}

function getTipoLabel(tipo: TipoMovimentacao): string {
  const labels: Record<TipoMovimentacao, string> = {
    CP: 'Pagamento',
    CR: 'Recebimento',
    TR: 'Transferência',
    APORTE: 'Aporte',
    RETIRADA: 'Retirada',
  };
  return labels[tipo] ?? tipo;
}

function getTipoTone(tipo: TipoMovimentacao): 'success' | 'danger' | 'neutral' | 'warning' {
  if (tipo === 'CR' || tipo === 'APORTE') return 'success';
  if (tipo === 'CP' || tipo === 'RETIRADA') return 'danger';
  return 'neutral';
}

export function ExtratoBancario() {
  const { formatCurrency } = useCurrency();
  const [contas] = useLoadAction(loadContasAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });

  const [contaId, setContaId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [tipo, setTipo] = useState<string>('all');
  const [matrizId, setMatrizId] = useState<string>('all');
  const [showExtrato, setShowExtrato] = useState(false);

  const [transacoes, transacoesLoading, transacoesError] = useLoadAction(loadExtratoAction, [], {
    contaId: contaId ? parseInt(contaId) : null,
    dataInicio: dataInicio ? formatDateForDatabase(dataInicio) : null,
    dataFim: dataFim ? formatDateForDatabase(dataFim) : null,
    tipo: tipo !== 'all' ? tipo : null,
    matrizId: matrizId !== 'all' ? parseInt(matrizId) : null,
  });

  const [saldoData] = useLoadAction(loadSaldoAnteriorAction, [], {
    contaId: contaId ? parseInt(contaId) : null,
    dataInicio: dataInicio ? formatDateForDatabase(dataInicio) : null,
  });

  const contaOptions = useMemo(
    () =>
      (contas || []).map((c: any) => ({
        value: String(c.id),
        label: `${c.nome}${c.banco ? ` — ${c.banco}` : ''}`,
      })),
    [contas],
  );

  const matrizOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas' },
      ...(matrizes || []).map((m: any) => ({ value: String(m.id), label: m.nome })),
    ],
    [matrizes],
  );

  const tipoOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'CP', label: 'Pagamentos' },
    { value: 'CR', label: 'Recebimentos' },
    { value: 'TR', label: 'Transferências' },
    { value: 'APORTE', label: 'Aportes' },
    { value: 'RETIRADA', label: 'Retiradas' },
  ];

  const transacoesComSaldo = useMemo((): TransacaoComSaldo[] => {
    if (!transacoes || !saldoData?.[0]) return [];
    const saldoAnterior = Number(saldoData[0].saldo_anterior) || 0;
    let acumulado = saldoAnterior;
    return transacoes.map((t: ExtratoTransaction) => {
      const valor = Number(t.valor) || 0;
      acumulado = Math.round((acumulado + valor) * 100) / 100;
      return {
        ...t,
        valor,
        saldo_linha: acumulado,
        entrada: valor > 0 ? valor : 0,
        saida: valor < 0 ? Math.abs(valor) : 0,
      };
    });
  }, [transacoes, saldoData]);

  const resumo = useMemo(() => {
    const saldoAnterior = Number(saldoData?.[0]?.saldo_anterior) || 0;
    const totalEntradas = transacoesComSaldo.reduce((acc, t) => acc + t.entrada, 0);
    const totalSaidas = transacoesComSaldo.reduce((acc, t) => acc + t.saida, 0);
    const saldoFinal =
      transacoesComSaldo.length > 0
        ? transacoesComSaldo[transacoesComSaldo.length - 1].saldo_linha
        : saldoAnterior;
    return { saldoAnterior, totalEntradas, totalSaidas, saldoFinal, count: transacoesComSaldo.length };
  }, [transacoesComSaldo, saldoData]);

  const contaInfo = saldoData?.[0];

  const handleGerar = () => {
    if (!contaId || !dataInicio || !dataFim) return;
    setShowExtrato(true);
  };

  const handleClearFilters = () => {
    setContaId('');
    setDataInicio(undefined);
    setDataFim(undefined);
    setTipo('all');
    setMatrizId('all');
    setShowExtrato(false);
  };

  const handleExportPDF = (withObs: boolean) => {
    if (!contaInfo) return;
    const matrizLabel = matrizId !== 'all' ? matrizOptions.find((m) => m.value === matrizId)?.label : undefined;
    exportExtratoBancarioPDF(
      transacoesComSaldo,
      `extrato_${(contaInfo.conta_nome || 'conta').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_')}`,
      {
        conta_nome: contaInfo.conta_nome || '',
        conta_banco: contaInfo.conta_banco || '',
        saldo_anterior: Number(contaInfo.saldo_anterior) || 0,
      },
      {
        dataInicio: dataInicio ? dataInicio.toLocaleDateString('pt-BR') : '',
        dataFim: dataFim ? dataFim.toLocaleDateString('pt-BR') : '',
        tipo: tipo !== 'all' ? getTipoLabel(tipo as TipoMovimentacao) : undefined,
        matrizNome: matrizLabel,
      },
      formatCurrency,
      formatDateForDisplay,
      withObs,
    );
  };

  const canGenerate = !!contaId && !!dataInicio && !!dataFim;

  return (
    <div className="space-y-6">
      <ListingPageHeader title="Extratos Bancários" description="" />

      <ListingFilterCard>
        <div className="grid gap-4 lg:grid-cols-[minmax(200px,1.5fr)_170px_170px_160px_180px]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Conta <span className="text-rose-500">*</span>
            </label>
            <Combobox
              value={contaId}
              onValueChange={setContaId}
              options={contaOptions}
              placeholder="Selecione uma conta"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Data inicial <span className="text-rose-500">*</span>
            </label>
            <DatePickerWithYearSelector date={dataInicio} onDateChange={setDataInicio} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Data final <span className="text-rose-500">*</span>
            </label>
            <DatePickerWithYearSelector date={dataFim} onDateChange={setDataFim} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Tipo</label>
            <Combobox value={tipo} onValueChange={setTipo} options={tipoOptions} placeholder="Todos" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Matriz</label>
            <Combobox value={matrizId} onValueChange={setMatrizId} options={matrizOptions} placeholder="Todas" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <Button type="button" className={listingSecondaryButtonClassName} onClick={handleClearFilters}>
            <X className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
          <Button
            type="button"
            className={listingPrimaryButtonClassName}
            disabled={!canGenerate}
            onClick={handleGerar}
          >
            <FileText className="mr-2 h-4 w-4" />
            Gerar extrato
          </Button>
          {showExtrato && transacoesComSaldo.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" className={listingSecondaryButtonClassName}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar PDF
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportPDF(false)}>
                  Extrato Resumido
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF(true)}>
                  Extrato com OBS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </ListingFilterCard>

      {showExtrato && canGenerate && (
        <>
          {/* Summary cards */}
          {contaInfo && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conta</p>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-900">{contaInfo.conta_nome}</p>
                  {contaInfo.conta_banco && (
                    <p className="truncate text-xs text-slate-500">{contaInfo.conta_banco}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saldo anterior</p>
                  <p
                    className={`mt-2 text-xl font-semibold tabular-nums ${resumo.saldoAnterior < 0 ? 'text-rose-600' : 'text-slate-900'}`}
                  >
                    {formatCurrency(resumo.saldoAnterior)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total entradas</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-600">
                    {formatCurrency(resumo.totalEntradas)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total saídas</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-rose-600">
                    {formatCurrency(resumo.totalSaidas)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saldo final</p>
                  <p
                    className={`mt-2 text-xl font-semibold tabular-nums ${resumo.saldoFinal < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                  >
                    {formatCurrency(resumo.saldoFinal)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Table */}
          <ListingTableCard>
            <CardContent className="p-0">
              {transacoesLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">Carregando extrato...</div>
              ) : transacoesError ? (
                <div className="py-12 text-center text-sm text-rose-600">Erro ao carregar extrato.</div>
              ) : transacoesComSaldo.length === 0 ? (
                <ListingEmptyState
                  icon={Calendar}
                  title="Nenhuma movimentação encontrada"
                  description="Não há movimentações para o período e filtros selecionados."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                        <TableHead className={listingTableHeadClassName}>Data</TableHead>
                        <TableHead className={listingTableHeadClassName}>Tipo</TableHead>
                        <TableHead className={listingTableHeadClassName}>Histórico / Favorecido</TableHead>
                        <TableHead className={listingTableHeadClassName}>Nº Doc</TableHead>
                        <TableHead className={listingTableHeadClassName}>Projeto</TableHead>
                        <TableHead className={listingTableHeadClassName}>Matriz</TableHead>
                        <TableHead className={`${listingTableHeadClassName} text-right`}>Entrada</TableHead>
                        <TableHead className={`${listingTableHeadClassName} text-right`}>Saída</TableHead>
                        <TableHead className={`${listingTableHeadClassName} text-right`}>Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transacoesComSaldo.map((t, idx) => (
                        <TableRow
                          key={idx}
                          className={`border-b border-slate-100 hover:bg-slate-50/70 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                        >
                          <TableCell className={`${listingTableCellClassName} whitespace-nowrap font-medium text-slate-900`}>
                            {formatDateForDisplay(t.data)}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>
                            <FinanceStatusBadge label={getTipoLabel(t.tipo)} tone={getTipoTone(t.tipo)} />
                          </TableCell>
                          <TableCell className={`${listingTableCellClassName} max-w-[220px] truncate`}>
                            {t.fornecedor_creditor || '—'}
                          </TableCell>
                          <TableCell className={listingTableCellClassName}>{t.numero_documento || '—'}</TableCell>
                          <TableCell className={listingTableCellClassName}>{t.projeto || '—'}</TableCell>
                          <TableCell className={listingTableCellClassName}>{t.matriz_nome || '—'}</TableCell>
                          <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                            {t.entrada > 0 ? (
                              <span className="font-medium text-emerald-600">{formatCurrency(t.entrada)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className={`${listingTableCellClassName} text-right tabular-nums`}>
                            {t.saida > 0 ? (
                              <span className="font-medium text-rose-600">{formatCurrency(t.saida)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell
                            className={`${listingTableCellClassName} text-right font-semibold tabular-nums ${t.saldo_linha < 0 ? 'text-rose-700' : 'text-slate-900'}`}
                          >
                            {formatCurrency(t.saldo_linha)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-slate-600">
                          {resumo.count} movimentaç{resumo.count !== 1 ? 'ões' : 'ão'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-emerald-600">
                          {formatCurrency(resumo.totalEntradas)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-rose-600">
                          {formatCurrency(resumo.totalSaidas)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${resumo.saldoFinal < 0 ? 'text-rose-700' : 'text-slate-900'}`}
                        >
                          {formatCurrency(resumo.saldoFinal)}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              )}
            </CardContent>
          </ListingTableCard>
        </>
      )}
    </div>
  );
}
