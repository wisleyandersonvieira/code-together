export type AuditoriaStatus = 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA';
export type ItemPagamentoStatus = 'PENDENTE' | 'PARCIAL' | 'PAGO';
export type ParcelaStatus = 'PENDENTE' | 'PAGO';

export interface AuditoriaItemAttachment {
  id?: number;
  filename: string;
  content_type?: string;
  file_size?: number;
  created_at?: string;
}

export interface AuditoriaParcelaForm {
  id?: number;
  numero_parcela: number;
  valor_parcela: number;
  status: ParcelaStatus;
  data_pagamento?: string | null;
  data_registro_baixa?: string | null;
  usuario_id?: number | null;
  observacao?: string | null;
}

export interface AuditoriaHistoricoPagamento {
  id?: number;
  numero_parcela: number;
  valor_pago: number;
  status: 'PAGO';
  data_pagamento: string;
  created_at?: string;
  usuario_id?: number | null;
  usuario_nome?: string | null;
  observacao?: string | null;
}

export interface AuditoriaItemForm {
  id?: number;
  client_key: string;
  fornecedor_subcontratado_id?: number;
  fornecedor_nome?: string;
  data_emissao?: string;
  valor_total: number;
  parcelas: number;
  projeto_id?: number;
  projeto_nome?: string;
  status_pagamento: ItemPagamentoStatus;
  valor_pago: number;
  valor_a_pagar: number;
  observacoes?: string;
  auditado?: boolean;
  parcelas_detalhes: AuditoriaParcelaForm[];
  historico_pagamentos: AuditoriaHistoricoPagamento[];
  anexos: AuditoriaItemAttachment[];
  pendingFiles: File[];
}

export interface AuditoriaFormData {
  id?: number;
  data_auditoria: string;
  status: AuditoriaStatus;
  quantidade_itens: number;
  valor_total: number;
  valor_pago: number;
  valor_a_pagar: number;
  items: AuditoriaItemForm[];
}

export function createAuditoriaClientKey() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function splitParcelas(valorTotal: number, parcelas: number): AuditoriaParcelaForm[] {
  const total = roundCurrency(valorTotal);
  const quantidade = Math.max(parcelas, 1);
  const base = roundCurrency(total / quantidade);
  const items: AuditoriaParcelaForm[] = [];
  let acumulado = 0;

  for (let index = 0; index < quantidade; index += 1) {
    const isLast = index === quantidade - 1;
    const valorParcela = isLast ? roundCurrency(total - acumulado) : base;
    acumulado = roundCurrency(acumulado + valorParcela);

    items.push({
      numero_parcela: index + 1,
      valor_parcela: valorParcela,
      status: 'PENDENTE',
      data_pagamento: null,
      observacao: null,
    });
  }

  return items;
}

export function getItemStatus(parcelas: AuditoriaParcelaForm[]): ItemPagamentoStatus {
  const pagas = parcelas.filter((parcela) => parcela.status === 'PAGO').length;

  if (pagas === 0) {
    return 'PENDENTE';
  }

  if (pagas === parcelas.length) {
    return 'PAGO';
  }

  return 'PARCIAL';
}

export function getAuditoriaStatus(items: AuditoriaItemForm[]): AuditoriaStatus {
  if (items.length === 0) {
    return 'ABERTA';
  }

  const pagos = items.filter((item) => item.status_pagamento === 'PAGO').length;
  const pendentes = items.filter((item) => item.status_pagamento === 'PENDENTE').length;

  if (pagos === items.length) {
    return 'QUITADA';
  }

  if (pendentes === items.length) {
    return 'ABERTA';
  }

  return 'PARCIALMENTE_PAGA';
}

export function calculateItemTotals(item: AuditoriaItemForm): AuditoriaItemForm {
  const valor_pago = roundCurrency(
    item.parcelas_detalhes
      .filter((parcela) => parcela.status === 'PAGO')
      .reduce((acc, parcela) => acc + Number(parcela.valor_parcela || 0), 0),
  );
  const valor_a_pagar = roundCurrency(Math.max(Number(item.valor_total || 0) - valor_pago, 0));

  return {
    ...item,
    valor_pago,
    valor_a_pagar,
    status_pagamento: getItemStatus(item.parcelas_detalhes),
  };
}

export function calculateAuditoriaTotals(items: AuditoriaItemForm[]) {
  const normalizedItems = items.map(calculateItemTotals);
  const valor_total = roundCurrency(normalizedItems.reduce((acc, item) => acc + Number(item.valor_total || 0), 0));
  const valor_pago = roundCurrency(normalizedItems.reduce((acc, item) => acc + Number(item.valor_pago || 0), 0));
  const valor_a_pagar = roundCurrency(Math.max(valor_total - valor_pago, 0));

  return {
    items: normalizedItems,
    quantidade_itens: normalizedItems.length,
    valor_total,
    valor_pago,
    valor_a_pagar,
    status: getAuditoriaStatus(normalizedItems),
  };
}

export function buildEmptyAuditoriaItem(): AuditoriaItemForm {
  const parcelas_detalhes = splitParcelas(0, 1);
  return calculateItemTotals({
    client_key: createAuditoriaClientKey(),
    valor_total: 0,
    parcelas: 1,
    status_pagamento: 'PENDENTE',
    valor_pago: 0,
    valor_a_pagar: 0,
    auditado: false,
    parcelas_detalhes,
    historico_pagamentos: [],
    anexos: [],
    pendingFiles: [],
  });
}

export function formatStatusLabel(status: AuditoriaStatus | ItemPagamentoStatus | ParcelaStatus) {
  switch (status) {
    case 'ABERTA':
      return 'Aberta';
    case 'PARCIALMENTE_PAGA':
      return 'Parcialmente paga';
    case 'QUITADA':
      return 'Quitada';
    case 'PENDENTE':
      return 'Pendente';
    case 'PARCIAL':
      return 'Parcial';
    case 'PAGO':
      return 'Pago';
    default:
      return status;
  }
}

export function getStatusTone(status: AuditoriaStatus | ItemPagamentoStatus | ParcelaStatus) {
  switch (status) {
    case 'QUITADA':
    case 'PAGO':
      return 'success' as const;
    case 'PARCIALMENTE_PAGA':
    case 'PARCIAL':
      return 'warning' as const;
    case 'ABERTA':
    case 'PENDENTE':
    default:
      return 'neutral' as const;
  }
}

export function formatDateForInput(value?: string | null) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}
