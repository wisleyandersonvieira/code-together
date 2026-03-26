'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import {
  Download,
  Edit,
  Eye,
  FileBarChart2,
  FileText,
  History,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';

import deleteAuditoriaFornecedorAction from '@/actions/deleteAuditoriaFornecedor';
import loadAuditoriaFornecedorByIdAction from '@/actions/loadAuditoriaFornecedorById';
import loadAuditoriasFornecedoresAction from '@/actions/loadAuditoriasFornecedores';
import loadFornecedoresSubcontratadosAction from '@/actions/loadFornecedoresSubcontratados';
import loadProjetosAction from '@/actions/loadProjetos';
import saveAuditoriaFornecedorAction from '@/actions/saveAuditoriaFornecedor';
import getFileAction from '@/actions/getFile';
import uploadFileAction from '@/actions/uploadFile';
import { AuditoriaItemAttachments } from '@/components/AuditoriaItemAttachments';
import { FinanceActionButton, FinanceStatusBadge, ListingEmptyState, ListingFilterCard, ListingPageHeader, ListingTableCard, listingFilterFieldClassName, listingPrimaryButtonClassName, listingSecondaryButtonClassName, listingTableCellClassName, listingTableHeadClassName } from '@/components/finance/listing-ui';
import {
  FinanceDetailHeader,
  FinanceDetailSectionCard,
  financeDetailFieldClassName,
  financeDetailMutedPanelClassName,
  financeDetailTableWrapClassName,
} from '@/components/finance/detail-ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePickerWithYearSelector } from '@/components/ui/date-picker-with-year-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/userContext';
import { formatDateForDisplay, formatDateForDatabase, parseLocalDate } from '@/utils/timezone';
import {
  buildEmptyAuditoriaItem,
  calculateAuditoriaTotals,
  calculateItemTotals,
  formatDateForInput,
  formatStatusLabel,
  getStatusTone,
  roundCurrency,
  splitParcelas,
  type AuditoriaFormData,
  type AuditoriaHistoricoPagamento,
  type AuditoriaItemAttachment,
  type AuditoriaItemForm,
  type AuditoriaParcelaForm,
} from '@/utils/auditoria-fornecedores';

type ModuleMode = 'list' | 'create' | 'edit' | 'view';
type AuditoriaListStatus = 'all' | 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA';

interface AuditoriaRow {
  id: number;
  data_auditoria: string;
  status: 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA';
  quantidade_itens: number;
  valor_total: number;
  valor_pago: number;
  valor_a_pagar: number;
  fornecedores?: string;
  projetos?: string;
}

interface OptionRow {
  id: number;
  nome_razao_social?: string;
  name?: string;
  status?: string;
}

function normalizeAuditoriaPayload(rawData: any): AuditoriaFormData {
  const baseItems = (rawData?.items || []).map((item: any) => {
    const parcelas = (item.parcelas_detalhes || []).map((parcela: any) => ({
      id: parcela.id,
      numero_parcela: Number(parcela.numero_parcela),
      valor_parcela: Number(parcela.valor_parcela || 0),
      status: parcela.status === 'PAGO' ? 'PAGO' : 'PENDENTE',
      data_pagamento: parcela.data_pagamento ? formatDateForInput(parcela.data_pagamento) : null,
      data_registro_baixa: parcela.data_registro_baixa || null,
      usuario_id: parcela.usuario_id ?? null,
      observacao: parcela.observacao || '',
    })) as AuditoriaParcelaForm[];

    const normalizedItem: AuditoriaItemForm = {
      id: item.id,
      client_key: `item-${item.id}`,
      fornecedor_subcontratado_id: Number(item.fornecedor_subcontratado_id),
      fornecedor_nome: item.fornecedor_nome || '',
      data_emissao: item.data_emissao ? formatDateForInput(item.data_emissao) : '',
      valor_total: Number(item.valor_total || 0),
      parcelas: Number(item.parcelas || parcelas.length || 1),
      projeto_id: item.projeto_id ? Number(item.projeto_id) : undefined,
      projeto_nome: item.projeto_nome || '',
      status_pagamento: item.status_pagamento || 'PENDENTE',
      valor_pago: Number(item.valor_pago || 0),
      valor_a_pagar: Number(item.valor_a_pagar || 0),
      observacoes: item.observacoes || '',
      auditado: item.auditado === true,
      parcelas_detalhes: parcelas.length > 0 ? parcelas : splitParcelas(Number(item.valor_total || 0), Number(item.parcelas || 1)),
      historico_pagamentos: (item.historico_pagamentos || []) as AuditoriaHistoricoPagamento[],
      anexos: (item.anexos || []) as AuditoriaItemAttachment[],
      pendingFiles: [],
    };

    return calculateItemTotals(normalizedItem);
  });

  const totals = calculateAuditoriaTotals(baseItems);

  return {
    id: rawData.id,
    data_auditoria: formatDateForInput(rawData.data_auditoria),
    status: rawData.status || totals.status,
    quantidade_itens: totals.quantidade_itens,
    valor_total: totals.valor_total,
    valor_pago: totals.valor_pago,
    valor_a_pagar: totals.valor_a_pagar,
    items: totals.items,
  };
}

function ParcelasDialog({
  item,
  onSave,
  readOnly = false,
}: {
  item: AuditoriaItemForm;
  onSave: (parcelas: AuditoriaParcelaForm[], novoValorTotal?: number) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftParcelas, setDraftParcelas] = useState<AuditoriaParcelaForm[]>(item.parcelas_detalhes);

  // Track which parcela numbers were already paid when dialog opened
  const [originalPaidNums] = useState<Set<number>>(
    () => new Set(item.parcelas_detalhes.filter((p) => p.status === 'PAGO').map((p) => p.numero_parcela)),
  );

  // Track custom paid amounts per parcela index
  const [valorPagoMap, setValorPagoMap] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    item.parcelas_detalhes.forEach((p, i) => {
      map[i] = p.valor_parcela;
    });
    return map;
  });

  useEffect(() => {
    setDraftParcelas(item.parcelas_detalhes);
    const map: Record<number, number> = {};
    item.parcelas_detalhes.forEach((p, i) => {
      map[i] = p.valor_parcela;
    });
    setValorPagoMap(map);
  }, [item]);

  const handleToggle = (index: number, checked: boolean) => {
    setDraftParcelas((current) =>
      current.map((parcela, parcelaIndex) => {
        if (parcelaIndex !== index) {
          return parcela;
        }

        return {
          ...parcela,
          status: checked ? 'PAGO' : 'PENDENTE',
          data_pagamento: checked ? parcela.data_pagamento || formatDateForDatabase(new Date()) : null,
        };
      }),
    );
    if (checked) {
      setValorPagoMap((current) => ({
        ...current,
        [index]: current[index] ?? draftParcelas[index]?.valor_parcela ?? 0,
      }));
    }
  };

  const handleDateChange = (index: number, date?: Date) => {
    setDraftParcelas((current) =>
      current.map((parcela, parcelaIndex) =>
        parcelaIndex === index
          ? {
              ...parcela,
              status: 'PAGO',
              data_pagamento: date ? formatDateForDatabase(date) : null,
            }
          : parcela,
      ),
    );
  };

  const handleSave = () => {
    const processedParcelas: AuditoriaParcelaForm[] = [];
    let nextNum = 1;
    let valorTotalAdjustment = 0;

    for (let i = 0; i < draftParcelas.length; i++) {
      const parcela = draftParcelas[i];
      const isNewlyPaid = parcela.status === 'PAGO' && !originalPaidNums.has(parcela.numero_parcela);

      if (isNewlyPaid) {
        const valorPago = roundCurrency(valorPagoMap[i] ?? parcela.valor_parcela);
        const valorOriginal = roundCurrency(parcela.valor_parcela);

        if (valorPago > 0 && valorPago < valorOriginal) {
          // Partial payment: mark this parcela with paid amount, create new pending for the remainder
          const remainder = roundCurrency(valorOriginal - valorPago);
          processedParcelas.push({ ...parcela, numero_parcela: nextNum++, valor_parcela: valorPago });
          processedParcelas.push({ numero_parcela: nextNum++, valor_parcela: remainder, status: 'PENDENTE', data_pagamento: null, observacao: null });
        } else if (valorPago > valorOriginal) {
          // Over-payment: use the higher value and track the adjustment to update item total
          valorTotalAdjustment = roundCurrency(valorTotalAdjustment + (valorPago - valorOriginal));
          processedParcelas.push({ ...parcela, numero_parcela: nextNum++, valor_parcela: valorPago });
        } else {
          // Full payment at original value (or zero fallback)
          processedParcelas.push({ ...parcela, numero_parcela: nextNum++, valor_parcela: valorPago > 0 ? valorPago : valorOriginal });
        }
      } else {
        processedParcelas.push({ ...parcela, numero_parcela: nextNum++ });
      }
    }

    const novoValorTotal = valorTotalAdjustment > 0
      ? roundCurrency(item.valor_total + valorTotalAdjustment)
      : undefined;

    onSave(processedParcelas, novoValorTotal);
    setOpen(false);
  };

  const canSave = draftParcelas.every((parcela) => parcela.status !== 'PAGO' || !!parcela.data_pagamento);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-8 rounded-lg border-slate-200 px-2.5 text-xs">
          Gerenciar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Parcelas do item</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-4">
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Total de parcelas</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{draftParcelas.length}</p>
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Pagas</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">
              {draftParcelas.filter((parcela) => parcela.status === 'PAGO').length}
            </p>
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Pendentes</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {draftParcelas.filter((parcela) => parcela.status !== 'PAGO').length}
            </p>
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-2">
              <FinanceStatusBadge label={formatStatusLabel(calculateItemTotals({ ...item, parcelas_detalhes: draftParcelas }).status_pagamento)} tone={getStatusTone(calculateItemTotals({ ...item, parcelas_detalhes: draftParcelas }).status_pagamento)} />
            </div>
          </div>
        </div>

        <div className={financeDetailTableWrapClassName}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                {!readOnly && <TableHead>Valor pago</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Data de pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftParcelas.map((parcela, index) => {
                const isNewlyPaid = parcela.status === 'PAGO' && !originalPaidNums.has(parcela.numero_parcela);
                return (
                  <TableRow key={parcela.id || parcela.numero_parcela}>
                    <TableCell className="font-medium text-slate-900">Parcela {parcela.numero_parcela}</TableCell>
                    <TableCell>{parcela.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    {!readOnly && (
                      <TableCell>
                        {isNewlyPaid ? (
                          <CurrencyInput
                            value={valorPagoMap[index] ?? parcela.valor_parcela}
                            onValueChange={(value) => setValorPagoMap((current) => ({ ...current, [index]: value }))}
                            className="h-9 w-36 rounded-xl border-slate-200"
                          />
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FinanceStatusBadge label={formatStatusLabel(parcela.status)} tone={getStatusTone(parcela.status)} />
                        {!readOnly ? (
                          <input
                            type="checkbox"
                            checked={parcela.status === 'PAGO'}
                            onChange={(event) => handleToggle(index, event.target.checked)}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DatePickerWithYearSelector
                        date={parcela.data_pagamento ? parseLocalDate(parcela.data_pagamento) : undefined}
                        onDateChange={(date) => handleDateChange(index, date)}
                        disabled={readOnly || parcela.status !== 'PAGO'}
                        triggerClassName="h-10"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {!readOnly ? (
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-slate-900 hover:bg-slate-800"
              disabled={!canSave}
              onClick={handleSave}
            >
              Aplicar pagamentos
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HistoricoDialog({ item }: { item: AuditoriaItemForm }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-8 rounded-lg border-slate-200 px-2.5 text-xs">
          <History className="mr-1.5 h-3.5 w-3.5" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Histórico de pagamento do item</DialogTitle>
        </DialogHeader>

        <div className={financeDetailTableWrapClassName}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor pago</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de pagamento</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.historico_pagamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                    Nenhum pagamento registrado para este item.
                  </TableCell>
                </TableRow>
              ) : (
                item.historico_pagamentos.map((historico) => (
                  <TableRow key={historico.id || `${historico.numero_parcela}-${historico.created_at}`}>
                    <TableCell>Parcela {historico.numero_parcela}</TableCell>
                    <TableCell>{historico.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <FinanceStatusBadge label={formatStatusLabel(historico.status)} tone={getStatusTone(historico.status)} />
                    </TableCell>
                    <TableCell>{formatDateForDisplay(historico.data_pagamento)}</TableCell>
                    <TableCell>{historico.created_at ? new Date(historico.created_at).toLocaleString('pt-BR') : '-'}</TableCell>
                    <TableCell>{historico.usuario_nome || '-'}</TableCell>
                    <TableCell>{historico.observacao || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnexosViewDialog({ files }: { files: AuditoriaItemAttachment[] }) {
  const { toast } = useToast();
  const [getFile] = useMutateAction(getFileAction);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = async (fileId: number, filename: string) => {
    try {
      setDownloadingId(fileId);
      const result = await getFile({ fileId });
      const fileData = result?.[0];
      if (!fileData?.file_data) throw new Error('Arquivo não encontrado');
      const base64Data = fileData.file_data.startsWith('data:') ? fileData.file_data.split(',')[1] : fileData.file_data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: fileData.content_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({ description: `Não foi possível baixar ${filename}.`, variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-8 rounded-lg border-slate-200 px-2.5 text-xs">
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
          {files.length > 0 ? `${files.length} anexo${files.length !== 1 ? 's' : ''}` : 'Anexos'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anexos do item</DialogTitle>
        </DialogHeader>
        {files.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhum anexo cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-sm text-slate-700">{file.filename}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={downloadingId === file.id}
                  onClick={() => file.id && handleDownload(file.id, file.filename)}
                  className="ml-2 h-8 shrink-0 rounded-lg border-slate-200 px-2.5 text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {downloadingId === file.id ? 'Baixando...' : 'Baixar'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnexosEditDialog({
  item,
  onPendingFilesChange,
  onUploadedFile,
  onDeletedFile,
}: {
  item: AuditoriaItemForm;
  onPendingFilesChange: (files: File[]) => void;
  onUploadedFile: (file: AuditoriaItemAttachment) => void;
  onDeletedFile: (fileId: number) => void;
}) {
  const totalFiles = item.anexos.length + item.pendingFiles.length;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-8 rounded-lg border-slate-200 px-2.5 text-xs">
          <Paperclip className="h-3.5 w-3.5" />
          {totalFiles > 0 ? <span className="ml-1">{totalFiles}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anexos do item</DialogTitle>
        </DialogHeader>
        <AuditoriaItemAttachments
          itemId={item.id}
          files={item.anexos}
          pendingFiles={item.pendingFiles}
          readOnly={false}
          onPendingFilesChange={onPendingFilesChange}
          onUploadedFile={onUploadedFile}
          onDeletedFile={onDeletedFile}
        />
      </DialogContent>
    </Dialog>
  );
}

function RelatorioContent({ auditoriaId }: { auditoriaId: number }) {
  const { formatCurrency } = useCurrency();
  const [auditoriaResponse, loading] = useLoadAction(loadAuditoriaFornecedorByIdAction, [], { id: auditoriaId });
  const auditoria = auditoriaResponse?.[0] ? normalizeAuditoriaPayload(auditoriaResponse[0]) : null;

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-500">Carregando...</div>;
  }

  if (!auditoria) {
    return <div className="py-8 text-center text-sm text-slate-500">Nenhuma informação encontrada.</div>;
  }

  const totals = calculateAuditoriaTotals(auditoria.items);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div>
          <p className="text-xs text-slate-500">Data da auditoria</p>
          <p className="font-medium text-slate-900">{formatDateForDisplay(auditoria.data_auditoria)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Status</p>
          <div className="mt-1">
            <FinanceStatusBadge label={formatStatusLabel(auditoria.status)} tone={getStatusTone(auditoria.status)} />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total de itens</p>
          <p className="font-medium text-slate-900">{auditoria.quantidade_itens}</p>
        </div>
      </div>

      <div className={financeDetailTableWrapClassName}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Valor Pago</TableHead>
              <TableHead>Valor Pendente</TableHead>
              <TableHead>Último Pagamento</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditoria.items.map((item) => {
              const lastPayment = item.parcelas_detalhes
                .filter((p) => p.status === 'PAGO' && p.data_pagamento)
                .sort((a, b) => (a.data_pagamento! > b.data_pagamento! ? -1 : 1))[0];
              return (
                <TableRow key={item.client_key}>
                  <TableCell className="font-medium text-slate-900">{item.fornecedor_nome || '-'}</TableCell>
                  <TableCell>{item.projeto_nome || '-'}</TableCell>
                  <TableCell>{formatCurrency(item.valor_total)}</TableCell>
                  <TableCell className="text-emerald-600">{formatCurrency(item.valor_pago)}</TableCell>
                  <TableCell>{formatCurrency(item.valor_a_pagar)}</TableCell>
                  <TableCell>{lastPayment?.data_pagamento ? formatDateForDisplay(lastPayment.data_pagamento) : '-'}</TableCell>
                  <TableCell>
                    <FinanceStatusBadge label={formatStatusLabel(item.status_pagamento)} tone={getStatusTone(item.status_pagamento)} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <tfoot>
            <TableRow className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <TableCell colSpan={2} className="text-slate-700">Total geral</TableCell>
              <TableCell className="text-slate-900">{formatCurrency(totals.valor_total)}</TableCell>
              <TableCell className="text-emerald-600">{formatCurrency(totals.valor_pago)}</TableCell>
              <TableCell className="text-slate-900">{formatCurrency(totals.valor_a_pagar)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </tfoot>
        </Table>
      </div>
    </div>
  );
}

function AuditoriaRelatorioDialog({ auditoriaId }: { auditoriaId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" title="Relatório" className="h-8 w-8 rounded-lg border border-slate-200 p-0 text-slate-600 hover:bg-slate-50">
          <FileBarChart2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>Relatório — Auditoria #{auditoriaId}</DialogTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()} className="rounded-lg">
              Imprimir
            </Button>
          </div>
        </DialogHeader>
        {open && <RelatorioContent auditoriaId={auditoriaId} />}
      </DialogContent>
    </Dialog>
  );
}

function AuditoriaFornecedorEditor({
  auditoriaId,
  readOnly,
  onBack,
  onSaved,
}: {
  auditoriaId?: number;
  readOnly: boolean;
  onBack: () => void;
  onSaved: () => void;
}) {
  const currentUser = useCurrentUser();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [suppliers] = useLoadAction(loadFornecedoresSubcontratadosAction, [], { status: 'all' });
  const [projects] = useLoadAction(loadProjetosAction, []);
  const [auditoriaResponse, loadingAuditoria] = useLoadAction(loadAuditoriaFornecedorByIdAction, [], {
    id: auditoriaId || null,
  });
  const [saveAuditoria, isSaving] = useMutateAction(saveAuditoriaFornecedorAction);
  const [uploadFile] = useMutateAction(uploadFileAction);

  const [formData, setFormData] = useState<AuditoriaFormData>({
    data_auditoria: formatDateForDatabase(new Date()),
    status: 'ABERTA',
    quantidade_itens: 0,
    valor_total: 0,
    valor_pago: 0,
    valor_a_pagar: 0,
    items: [buildEmptyAuditoriaItem()],
  });

  useEffect(() => {
    if (!auditoriaId) {
      return;
    }

    if (auditoriaResponse?.[0]) {
      setFormData(normalizeAuditoriaPayload(auditoriaResponse[0]));
    }
  }, [auditoriaId, auditoriaResponse]);

  const supplierOptions = useMemo(
    () =>
      (suppliers || []).map((supplier: OptionRow) => ({
        value: String(supplier.id),
        label: supplier.nome_razao_social || '',
      })),
    [suppliers],
  );

  const projectOptions = useMemo(
    () =>
      (projects || []).map((project: OptionRow) => ({
        value: String(project.id),
        label: project.name || '',
      })),
    [projects],
  );

  const syncFormData = (items: AuditoriaItemForm[], overrides?: Partial<AuditoriaFormData>) => {
    const totals = calculateAuditoriaTotals(items);
    setFormData((current) => ({
      ...current,
      ...overrides,
      quantidade_itens: totals.quantidade_itens,
      valor_total: totals.valor_total,
      valor_pago: totals.valor_pago,
      valor_a_pagar: totals.valor_a_pagar,
      status: totals.status,
      items: totals.items,
    }));
  };

  const updateItem = (clientKey: string, updater: (item: AuditoriaItemForm) => AuditoriaItemForm) => {
    syncFormData(formData.items.map((item) => (item.client_key === clientKey ? updater(item) : item)));
  };

  const handleItemParcelasChange = (item: AuditoriaItemForm, parcelas: number) => {
    if (item.parcelas_detalhes.some((parcelaDetalhe) => parcelaDetalhe.status === 'PAGO')) {
      toast({
        description: 'Não é possível alterar a quantidade de parcelas de um item que já possui pagamento registrado.',
        variant: 'destructive',
      });
      return;
    }

    const nextParcelas = Math.max(parcelas, 1);
    updateItem(item.client_key, (current) =>
      calculateItemTotals({
        ...current,
        parcelas: nextParcelas,
        parcelas_detalhes: splitParcelas(current.valor_total, nextParcelas),
      }),
    );
  };

  const handleItemValueChange = (item: AuditoriaItemForm, value: number) => {
    const paidCount = item.parcelas_detalhes.filter((parcela) => parcela.status === 'PAGO').length;
    const paidTotal = item.parcelas_detalhes
      .filter((parcela) => parcela.status === 'PAGO')
      .reduce((acc, parcela) => acc + Number(parcela.valor_parcela || 0), 0);

    if (paidCount > 0 && value < paidTotal) {
      toast({
        description: 'O valor total do item não pode ficar menor que o valor já pago.',
        variant: 'destructive',
      });
      return;
    }

    updateItem(item.client_key, (current) => {
      const recalculatedParcelas = splitParcelas(value, current.parcelas).map((parcela) => {
        const existing = current.parcelas_detalhes.find((detail) => detail.numero_parcela === parcela.numero_parcela);
        if (existing?.status === 'PAGO') {
          return existing;
        }
        return {
          ...parcela,
          id: existing?.id,
          observacao: existing?.observacao || '',
        };
      });

      return calculateItemTotals({
        ...current,
        valor_total: value,
        parcelas_detalhes: recalculatedParcelas,
      });
    });
  };

  const removeItem = (item: AuditoriaItemForm) => {
    if (item.parcelas_detalhes.some((parcela) => parcela.status === 'PAGO')) {
      toast({
        description: 'Itens com pagamento registrado não podem ser excluídos.',
        variant: 'destructive',
      });
      return;
    }

    const nextItems = formData.items.filter((current) => current.client_key !== item.client_key);
    syncFormData(nextItems.length > 0 ? nextItems : [buildEmptyAuditoriaItem()]);
  };

  const fileToBase64 = async (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSave = async () => {
    const invalidItem = formData.items.find(
      (item) =>
        !item.fornecedor_subcontratado_id ||
        !item.projeto_id ||
        item.valor_total <= 0 ||
        item.parcelas < 1 ||
        item.parcelas_detalhes.some((parcela) => parcela.status === 'PAGO' && !parcela.data_pagamento),
    );

    if (!formData.data_auditoria) {
      toast({
        description: 'Informe a data da auditoria.',
        variant: 'destructive',
      });
      return;
    }

    if (invalidItem) {
      toast({
        description: 'Preencha fornecedor, projeto, valor, parcelas e datas de pagamento obrigatórias.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      auditoria_id: formData.id || null,
      data_auditoria: formData.data_auditoria,
      items: formData.items.map((item) => ({
        id: item.id || null,
        client_key: item.client_key,
        fornecedor_subcontratado_id: item.fornecedor_subcontratado_id,
        data_emissao: item.data_emissao || null,
        valor_total: item.valor_total,
        parcelas: item.parcelas,
        projeto_id: item.projeto_id,
        observacoes: item.observacoes || null,
        auditado: item.auditado || false,
        parcelas_detalhes: item.parcelas_detalhes.map((parcela) => ({
          id: parcela.id || null,
          numero_parcela: parcela.numero_parcela,
          valor_parcela: parcela.valor_parcela,
          status: parcela.status,
          data_pagamento: parcela.data_pagamento || null,
          observacao: parcela.observacao || null,
        })),
      })),
    };

    try {
      const result = await saveAuditoria({
        payload,
        userId: currentUser?.id || null,
      });

      const data = result?.[0]?.data;
      const mappings = new Map<string, number>(
        (data?.item_mappings || []).map((mapping: { client_key: string; item_id: number }) => [mapping.client_key, Number(mapping.item_id)]),
      );

      for (const item of formData.items) {
        const entityId = item.id || mappings.get(item.client_key);
        if (!entityId || item.pendingFiles.length === 0) {
          continue;
        }

        for (const file of item.pendingFiles) {
          const fileData = await fileToBase64(file);
          await uploadFile({
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            fileSize: file.size,
            fileData,
            entityType: 'auditoria_item',
            entityId,
          });
        }
      }

      toast({ description: 'Auditoria salva com sucesso.' });
      onSaved();
    } catch (error: unknown) {
      toast({
        description: error instanceof Error ? error.message : 'Não foi possível salvar a auditoria.',
        variant: 'destructive',
      });
    }
  };

  const readyState = calculateAuditoriaTotals(formData.items);

  if (auditoriaId && loadingAuditoria) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-500">Carregando auditoria...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <FinanceDetailHeader
        title={readOnly ? `Visualizar Auditoria #${formData.id}` : formData.id ? `Editar Auditoria #${formData.id}` : 'Cadastrar Auditoria'}
        subtitle="Controle fornecedores, parcelas, histórico e anexos por linha com rastreabilidade completa."
        onBack={onBack}
      />

      <FinanceDetailSectionCard title="Cabeçalho da auditoria" description="Dados gerais e totalizadores em tempo real.">
        <div className="grid gap-4 lg:grid-cols-[260px_repeat(4,1fr)]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data da auditoria</label>
            <DatePickerWithYearSelector
              date={formData.data_auditoria ? parseLocalDate(formData.data_auditoria) : undefined}
              onDateChange={(date) => setFormData((current) => ({ ...current, data_auditoria: date ? formatDateForDatabase(date) : '' }))}
              disabled={readOnly}
            />
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Itens</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{readyState.quantidade_itens}</p>
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Valor total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(readyState.valor_total)}</p>
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Valor pago</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatCurrency(readyState.valor_pago)}</p>
          </div>
          <div className={financeDetailMutedPanelClassName}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Valor a pagar</p>
            <div className="mt-2">
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(readyState.valor_a_pagar)}</p>
              <div className="mt-2">
                <FinanceStatusBadge label={formatStatusLabel(readyState.status)} tone={getStatusTone(readyState.status)} />
              </div>
            </div>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Itens auditados"
        description="Cada linha representa um item auditado da obra com seus pagamentos e anexos."
        action={
          !readOnly ? (
            <Button
              type="button"
              className="rounded-xl bg-slate-900 hover:bg-slate-800"
              onClick={() => syncFormData([...formData.items, buildEmptyAuditoriaItem()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar linha
            </Button>
          ) : null
        }
      >
        <div className={financeDetailTableWrapClassName}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data emissão</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Auditado</TableHead>
                <TableHead>Anexos</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead>Observação</TableHead>
                {!readOnly ? <TableHead>Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {readyState.items.map((item) => (
                <TableRow key={item.client_key} className="align-top">
                  <TableCell className="min-w-[160px]">
                    {readOnly ? (
                      <p className="font-medium text-slate-900">{item.fornecedor_nome || '-'}</p>
                    ) : (
                      <div className="space-y-2">
                        <Combobox
                          value={item.fornecedor_subcontratado_id ? String(item.fornecedor_subcontratado_id) : ''}
                          onValueChange={(value) =>
                            updateItem(item.client_key, (current) => ({
                              ...current,
                              fornecedor_subcontratado_id: Number(value),
                              fornecedor_nome: supplierOptions.find((option) => option.value === value)?.label || '',
                            }))
                          }
                          options={supplierOptions}
                          placeholder="Selecionar fornecedor"
                          className="h-11 rounded-xl border-slate-200"
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[130px]">
                    {readOnly ? (
                      <span>{formatDateForDisplay(item.data_emissao)}</span>
                    ) : (
                      <Input
                        type="date"
                        value={item.data_emissao || ''}
                        onChange={(e) =>
                          updateItem(item.client_key, (current) => ({
                            ...current,
                            data_emissao: e.target.value,
                          }))
                        }
                        className="h-9 w-36 rounded-xl border-slate-200"
                      />
                    )}
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    {readOnly ? (
                      <p className="font-medium text-slate-900">{formatCurrency(item.valor_total)}</p>
                    ) : (
                      <CurrencyInput
                        value={item.valor_total}
                        onValueChange={(value) => handleItemValueChange(item, value)}
                        className={financeDetailFieldClassName}
                      />
                    )}
                  </TableCell>
                  <TableCell className="min-w-[80px]">
                    {readOnly ? (
                      <span>{item.parcelas}</span>
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        value={item.parcelas}
                        className={financeDetailFieldClassName}
                        onChange={(event) => handleItemParcelasChange(item, Number(event.target.value || 1))}
                      />
                    )}
                  </TableCell>
                  <TableCell className="min-w-[150px]">
                    {readOnly ? (
                      <span>{item.projeto_nome || '-'}</span>
                    ) : (
                      <Combobox
                        value={item.projeto_id ? String(item.projeto_id) : ''}
                        onValueChange={(value) =>
                          updateItem(item.client_key, (current) => ({
                            ...current,
                            projeto_id: Number(value),
                            projeto_nome: projectOptions.find((option) => option.value === value)?.label || '',
                          }))
                        }
                        options={projectOptions}
                        placeholder="Selecionar projeto"
                        className="h-11 rounded-xl border-slate-200"
                      />
                    )}
                  </TableCell>
                  <TableCell className="min-w-[160px]">
                    <div className="space-y-2">
                      <FinanceStatusBadge label={formatStatusLabel(item.status_pagamento)} tone={getStatusTone(item.status_pagamento)} />
                      <div className="text-xs text-slate-500">
                        <div>Pago: {formatCurrency(item.valor_pago)}</div>
                        <div>A pagar: {formatCurrency(item.valor_a_pagar)}</div>
                      </div>
                      <ParcelasDialog
                        item={item}
                        readOnly={readOnly}
                        onSave={(parcelas, novoValorTotal) =>
                          updateItem(item.client_key, (current) =>
                            calculateItemTotals({
                              ...current,
                              ...(novoValorTotal !== undefined ? { valor_total: novoValorTotal } : {}),
                              parcelas: parcelas.length,
                              parcelas_detalhes: parcelas,
                            }),
                          )
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[90px]">
                    {readOnly ? (
                      <span className={`inline-flex h-7 items-center rounded-lg border px-3 text-xs font-medium ${item.auditado ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-rose-200 bg-rose-100 text-rose-700'}`}>
                        {item.auditado ? 'Sim' : 'Não'}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateItem(item.client_key, (current) => ({ ...current, auditado: !current.auditado }))}
                        className={`h-7 rounded-lg border px-3 text-xs font-medium shadow-none ${item.auditado ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                      >
                        {item.auditado ? 'Sim' : 'Não'}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[80px]">
                    {readOnly ? (
                      <AnexosViewDialog files={item.anexos} />
                    ) : (
                      <AnexosEditDialog
                        item={item}
                        onPendingFilesChange={(pendingFiles) =>
                          updateItem(item.client_key, (current) => ({ ...current, pendingFiles }))
                        }
                        onUploadedFile={(file) =>
                          updateItem(item.client_key, (current) => ({ ...current, anexos: [file, ...current.anexos] }))
                        }
                        onDeletedFile={(fileId) =>
                          updateItem(item.client_key, (current) => ({ ...current, anexos: current.anexos.filter((a) => a.id !== fileId) }))
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <HistoricoDialog item={item} />
                  </TableCell>
                  <TableCell className="min-w-[160px]">
                    {readOnly ? (
                      <span className="text-sm text-slate-700">{item.observacoes || '-'}</span>
                    ) : (
                      <Textarea
                        value={item.observacoes || ''}
                        onChange={(event) =>
                          updateItem(item.client_key, (current) => ({ ...current, observacoes: event.target.value }))
                        }
                        className="min-h-[80px] rounded-xl border-slate-200 text-sm"
                        placeholder="Observações"
                      />
                    )}
                  </TableCell>
                  {!readOnly ? (
                    <TableCell className="min-w-[70px]">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir linha auditada?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Linhas com pagamentos registrados não podem ser excluídas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeItem(item)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!readOnly ? (
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
              Cancelar / Voltar
            </Button>
            <Button type="button" className="rounded-xl bg-slate-900 hover:bg-slate-800" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar auditoria'}
            </Button>
          </div>
        ) : null}
      </FinanceDetailSectionCard>
    </div>
  );
}

export function AuditoriaFornecedoresModule() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [mode, setMode] = useState<ModuleMode>('list');
  const [selectedAuditoriaId, setSelectedAuditoriaId] = useState<number | undefined>(undefined);

  const [searchDataInicial, setSearchDataInicial] = useState<Date | undefined>();
  const [searchDataFinal, setSearchDataFinal] = useState<Date | undefined>();
  const [searchFornecedorId, setSearchFornecedorId] = useState<string>('all');
  const [searchProjetoId, setSearchProjetoId] = useState<string>('all');
  const [searchStatus, setSearchStatus] = useState<AuditoriaListStatus>('all');

  const [auditorias, loading, error, refresh] = useLoadAction(loadAuditoriasFornecedoresAction, [], {
    dataInicial: searchDataInicial ? formatDateForDatabase(searchDataInicial) : null,
    dataFinal: searchDataFinal ? formatDateForDatabase(searchDataFinal) : null,
    fornecedorId: searchFornecedorId !== 'all' ? Number(searchFornecedorId) : null,
    projetoId: searchProjetoId !== 'all' ? Number(searchProjetoId) : null,
    status: searchStatus,
  });
  const [suppliers] = useLoadAction(loadFornecedoresSubcontratadosAction, [], { status: 'all' });
  const [projects] = useLoadAction(loadProjetosAction, []);
  const [deleteAuditoria] = useMutateAction(deleteAuditoriaFornecedorAction);

  const listTotals = useMemo(
    () =>
      (auditorias || []).reduce(
        (acc: { total: number; pago: number; aPagar: number }, auditoria: AuditoriaRow) => ({
          total: acc.total + Number(auditoria.valor_total || 0),
          pago: acc.pago + Number(auditoria.valor_pago || 0),
          aPagar: acc.aPagar + Number(auditoria.valor_a_pagar || 0),
        }),
        { total: 0, pago: 0, aPagar: 0 },
      ),
    [auditorias],
  );

  const supplierOptions = useMemo(
    () => (suppliers || []).map((supplier: OptionRow) => ({ value: String(supplier.id), label: supplier.nome_razao_social || '' })),
    [suppliers],
  );

  const projectOptions = useMemo(
    () => (projects || []).map((project: OptionRow) => ({ value: String(project.id), label: project.name || '' })),
    [projects],
  );

  const handleDelete = async (id: number) => {
    try {
      await deleteAuditoria({ id });
      toast({ description: 'Auditoria excluída com sucesso.' });
      refresh();
    } catch (error: unknown) {
      toast({
        description: error instanceof Error ? error.message : 'Não foi possível excluir a auditoria.',
        variant: 'destructive',
      });
    }
  };

  if (mode !== 'list') {
    return (
      <AuditoriaFornecedorEditor
        auditoriaId={selectedAuditoriaId}
        readOnly={mode === 'view'}
        onBack={() => {
          setMode('list');
          setSelectedAuditoriaId(undefined);
          refresh();
        }}
        onSaved={() => {
          setMode('list');
          setSelectedAuditoriaId(undefined);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Auditoria > Auditorias"
        description="Audite cobranças de fornecedores e subcontratados por obra com controle de parcelas, passivos e anexos."
        action={
          <Button
            className={listingPrimaryButtonClassName}
            onClick={() => {
              setSelectedAuditoriaId(undefined);
              setMode('create');
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar auditoria
          </Button>
        }
      />

      <ListingFilterCard>
        <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data inicial</label>
            <DatePickerWithYearSelector date={searchDataInicial} onDateChange={setSearchDataInicial} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Data final</label>
            <DatePickerWithYearSelector date={searchDataFinal} onDateChange={setSearchDataFinal} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Fornecedor</label>
            <div className={listingFilterFieldClassName}>
              <Combobox value={searchFornecedorId} onValueChange={setSearchFornecedorId} options={[{ value: 'all', label: 'Todos' }, ...supplierOptions]} placeholder="Todos" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Projeto</label>
            <div className={listingFilterFieldClassName}>
              <Combobox value={searchProjetoId} onValueChange={setSearchProjetoId} options={[{ value: 'all', label: 'Todos' }, ...projectOptions]} placeholder="Todos" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              className={`${listingFilterFieldClassName} w-full`}
              value={searchStatus}
              onChange={(event) => setSearchStatus(event.target.value as AuditoriaListStatus)}
            >
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
              setSearchDataInicial(undefined);
              setSearchDataFinal(undefined);
              setSearchFornecedorId('all');
              setSearchProjetoId('all');
              setSearchStatus('all');
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      </ListingFilterCard>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor total listado</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(listTotals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor pago</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(listTotals.pago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor a pagar</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(listTotals.aPagar)}</p>
          </CardContent>
        </Card>
      </div>

      <ListingTableCard>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando auditorias...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-600">Erro ao carregar auditorias.</div>
          ) : (auditorias || []).length === 0 ? (
            <ListingEmptyState
              icon={Receipt}
              title="Nenhuma auditoria encontrada"
              description="Cadastre a primeira auditoria para começar a acompanhar passivos e pagamentos."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                    <TableHead className={listingTableHeadClassName}>ID</TableHead>
                    <TableHead className={listingTableHeadClassName}>Data</TableHead>
                    <TableHead className={listingTableHeadClassName}>Itens</TableHead>
                    <TableHead className={listingTableHeadClassName}>Valor total</TableHead>
                    <TableHead className={listingTableHeadClassName}>Valor pago</TableHead>
                    <TableHead className={listingTableHeadClassName}>Valor a pagar</TableHead>
                    <TableHead className={listingTableHeadClassName}>Status</TableHead>
                    <TableHead className={`${listingTableHeadClassName} text-right`}>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditorias || []).map((auditoria: AuditoriaRow) => (
                    <TableRow key={auditoria.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <TableCell className={`${listingTableCellClassName} font-medium text-slate-900`}>#{auditoria.id}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <div>
                          <p className="font-medium text-slate-900">{formatDateForDisplay(auditoria.data_auditoria)}</p>
                          <p className="text-xs text-slate-500">{auditoria.fornecedores || 'Sem fornecedores'}</p>
                        </div>
                      </TableCell>
                      <TableCell className={listingTableCellClassName}>{auditoria.quantidade_itens}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatCurrency(auditoria.valor_total)}</TableCell>
                      <TableCell className={`${listingTableCellClassName} text-emerald-600`}>{formatCurrency(auditoria.valor_pago)}</TableCell>
                      <TableCell className={listingTableCellClassName}>{formatCurrency(auditoria.valor_a_pagar)}</TableCell>
                      <TableCell className={listingTableCellClassName}>
                        <FinanceStatusBadge label={formatStatusLabel(auditoria.status)} tone={getStatusTone(auditoria.status)} />
                      </TableCell>
                      <TableCell className={`${listingTableCellClassName} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <FinanceActionButton
                            icon={Eye}
                            title="Visualizar"
                            onClick={() => {
                              setSelectedAuditoriaId(auditoria.id);
                              setMode('view');
                            }}
                          />
                          <FinanceActionButton
                            icon={Edit}
                            title="Editar"
                            onClick={() => {
                              setSelectedAuditoriaId(auditoria.id);
                              setMode('edit');
                            }}
                            tone="brand"
                          />
                          <AuditoriaRelatorioDialog auditoriaId={auditoria.id} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-rose-200 p-0 text-rose-600 hover:bg-rose-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir auditoria?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Auditorias com pagamentos registrados não podem ser excluídas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(auditoria.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
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
