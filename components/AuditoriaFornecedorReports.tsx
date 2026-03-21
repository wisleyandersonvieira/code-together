'use client';

import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { BarChart3, X } from 'lucide-react';

import loadAuditoriaFornecedoresReportAction from '@/actions/loadAuditoriaFornecedoresReport';
import loadFornecedoresSubcontratadosAction from '@/actions/loadFornecedoresSubcontratados';
import loadProjetosAction from '@/actions/loadProjetos';
import { ListingEmptyState, ListingFilterCard, ListingPageHeader, ListingTableCard, listingSecondaryButtonClassName, listingTableCellClassName, listingTableHeadClassName } from '@/components/finance/listing-ui';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/use-currency';
import { formatDateForDatabase } from '@/utils/timezone';

type ReportStatus = 'all' | 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA';

interface ReportRow {
  projeto_nome: string;
  fornecedor_nome: string;
  total_auditorias: number;
  total_itens: number;
  valor_total: number;
  valor_pago: number;
  valor_a_pagar: number;
}

interface OptionRow {
  id: number;
  nome_razao_social?: string;
  name?: string;
}

export function AuditoriaFornecedorReports() {
  const { formatCurrency } = useCurrency();
  const [dataInicial, setDataInicial] = useState<Date | undefined>();
  const [dataFinal, setDataFinal] = useState<Date | undefined>();
  const [fornecedorId, setFornecedorId] = useState('all');
  const [projetoId, setProjetoId] = useState('all');
  const [status, setStatus] = useState<ReportStatus>('all');

  const [rows, loading, error] = useLoadAction(loadAuditoriaFornecedoresReportAction, [], {
    dataInicial: dataInicial ? formatDateForDatabase(dataInicial) : null,
    dataFinal: dataFinal ? formatDateForDatabase(dataFinal) : null,
    fornecedorId: fornecedorId !== 'all' ? Number(fornecedorId) : null,
    projetoId: projetoId !== 'all' ? Number(projetoId) : null,
    status,
  });
  const [suppliers] = useLoadAction(loadFornecedoresSubcontratadosAction, [], { status: 'all' });
  const [projects] = useLoadAction(loadProjetosAction, []);

  const totals = useMemo(
    () =>
      (rows || []).reduce(
        (acc: { valor_total: number; valor_pago: number; valor_a_pagar: number; auditorias: number }, row: ReportRow) => ({
          valor_total: acc.valor_total + Number(row.valor_total || 0),
          valor_pago: acc.valor_pago + Number(row.valor_pago || 0),
          valor_a_pagar: acc.valor_a_pagar + Number(row.valor_a_pagar || 0),
          auditorias: acc.auditorias + Number(row.total_auditorias || 0),
        }),
        { valor_total: 0, valor_pago: 0, valor_a_pagar: 0, auditorias: 0 },
      ),
    [rows],
  );

  const supplierOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...(suppliers || []).map((supplier: OptionRow) => ({ value: String(supplier.id), label: supplier.nome_razao_social || '' }))],
    [suppliers],
  );

  const projectOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...(projects || []).map((project: OptionRow) => ({ value: String(project.id), label: project.name || '' }))],
    [projects],
  );

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Auditoria > Relatórios"
        description="Visão consolidada por projeto e fornecedor para acompanhar passivos, pagamentos e exposição."
      />

      <ListingFilterCard>
        <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_200px]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data inicial</label>
            <DatePickerWithYearSelector date={dataInicial} onDateChange={setDataInicial} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data final</label>
            <DatePickerWithYearSelector date={dataFinal} onDateChange={setDataFinal} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Fornecedor</label>
            <Combobox value={fornecedorId} onValueChange={setFornecedorId} options={supplierOptions} placeholder="Todos" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Projeto</label>
            <Combobox value={projetoId} onValueChange={setProjetoId} options={projectOptions} placeholder="Todos" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm" value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)}>
              <option value="all">Todos</option>
              <option value="ABERTA">Aberta</option>
              <option value="PARCIALMENTE_PAGA">Parcialmente paga</option>
              <option value="QUITADA">Quitada</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            className={listingSecondaryButtonClassName}
            onClick={() => {
              setDataInicial(undefined);
              setDataFinal(undefined);
              setFornecedorId('all');
              setProjetoId('all');
              setStatus('all');
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      </ListingFilterCard>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Auditorias somadas</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.auditorias}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.valor_total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pago</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(totals.valor_pago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">A pagar</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.valor_a_pagar)}</p>
          </CardContent>
        </Card>
      </div>

      <ListingTableCard>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando relatório...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-600">Erro ao carregar relatório.</div>
          ) : (rows || []).length === 0 ? (
            <ListingEmptyState icon={BarChart3} title="Sem dados para o relatório" description="Ajuste os filtros ou cadastre auditorias para visualizar consolidados." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>Projeto</TableHead>
                    <TableHead className={listingTableHeadClassName}>Fornecedor</TableHead>
                    <TableHead className={listingTableHeadClassName}>Auditorias</TableHead>
                    <TableHead className={listingTableHeadClassName}>Itens</TableHead>
                    <TableHead className={listingTableHeadClassName}>Valor total</TableHead>
                    <TableHead className={listingTableHeadClassName}>Pago</TableHead>
                    <TableHead className={listingTableHeadClassName}>A pagar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows || []).map((row: ReportRow, index: number) => (
                    <TableRow key={`${row.projeto_nome}-${row.fornecedor_nome}-${index}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>{row.projeto_nome}</TableCell>
                      <TableCell className={listingTableCellClassName}>{row.fornecedor_nome}</TableCell>
                      <TableCell className={listingTableCellClassName}>{row.total_auditorias}</TableCell>
                      <TableCell className={listingTableCellClassName}>{row.total_itens}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatCurrency(row.valor_total)}</TableCell>
                      <TableCell className={`${listingTableCellClassName} text-emerald-600`}>{formatCurrency(row.valor_pago)}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatCurrency(row.valor_a_pagar)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </ListingTableCard>
    </div>
  );
}
