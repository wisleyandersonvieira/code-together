import { formatDateForDisplay, parseLocalDate } from '@/utils/timezone';

export type ProfitabilityViewType = 'project_total' | 'by_members';
export type CashFlowKind = 'real_aporte' | 'future_aporte' | 'exit';

export interface RealProjectFlow {
  fluxo_real_id: number;
  projeto_id: number;
  projeto_nome: string;
  membro_id: number;
  percentage: number;
  membro_nome: string;
  membro_tipo: string;
  data_fluxo: string;
  data_previsao?: string | null;
  valor: number | string;
  conta_receber_id?: number | null;
  numero_documento?: string | null;
  observacoes?: string | null;
}

export interface FutureSimulatedFlowInput {
  id: string;
  date: string;
  amount: number;
  memberId: number | null;
  note: string;
}

export interface ProjectMemberOption {
  id: number;
  nome: string;
  percentage: number;
}

export interface ProfitabilityFlowRow {
  id: string;
  type: CashFlowKind;
  typeLabel: string;
  date: string;
  memberId: number | null;
  memberName: string;
  participationPercentage: number | null;
  amount: number;
  signedAmount: number;
  daysToExit: number;
  equivalentYears: number;
  observation: string;
}

export interface ProfitabilityReportResult {
  projectName: string;
  viewType: ProfitabilityViewType;
  selectedMemberNames: string[];
  exitDate: string;
  lucroLiquidoInformado: number;
  lucroConsiderado: number;
  percentualTotalConsiderado: number | null;
  totalInvestidoReal: number;
  totalAportesFuturos: number;
  totalInvestidoGeral: number;
  valorSaida: number;
  rentabilidadeSimples: number | null;
  tirAnual: number | null;
  taxaEquivalentePeriodo: number | null;
  diasTotal: number;
  firstFlowDate: string;
  flows: ProfitabilityFlowRow[];
  warnings: string[];
  ignoredFutureFlowCount: number;
}

export interface ProfitabilityComputationInput {
  projectName: string;
  viewType: ProfitabilityViewType;
  selectedMemberIds: number[];
  exitDate: string;
  lucroLiquido: number;
  realFlows: RealProjectFlow[];
  futureFlows: FutureSimulatedFlowInput[];
  members: ProjectMemberOption[];
  today?: Date;
}

export interface ProfitabilityValidationResult {
  errors: string[];
  warnings: string[];
}

type XirrCashFlow = {
  amount: number;
  date: string;
};

function toNumber(value: number | string | null | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(numeric) ? numeric : 0;
}

function diffDays(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const millisPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / millisPerDay);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getFutureFlowValidation(
  futureFlows: FutureSimulatedFlowInput[],
  viewType: ProfitabilityViewType,
  selectedMemberIds: number[],
  projectMembers: ProjectMemberOption[],
  exitDate: string,
  firstHistoricalDate?: string | null,
  today: Date = new Date(),
): ProfitabilityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const memberIds = new Set(projectMembers.map((member) => member.id));
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  futureFlows.forEach((flow, index) => {
    const label = `Aporte futuro ${index + 1}`;

    if (!flow.date) {
      errors.push(`${label}: informe a data.`);
    }

    if (flow.amount <= 0) {
      errors.push(`${label}: o valor do aporte deve ser maior que zero.`);
    }

    if (flow.date && exitDate && flow.date > exitDate) {
      errors.push(`${label}: a data do aporte não pode ser maior que a data final de saída.`);
    }

    if (viewType === 'by_members' && !flow.memberId) {
      errors.push(`${label}: no modo "Por membros", o membro é obrigatório.`);
    }

    if (flow.memberId && !memberIds.has(flow.memberId)) {
      errors.push(`${label}: o membro informado não pertence ao projeto.`);
    }

    if (flow.date && flow.date < todayIso) {
      warnings.push(`${label}: a data está no passado e será tratada como simulação retroativa.`);
    }

    if (flow.date && firstHistoricalDate && flow.date < firstHistoricalDate) {
      warnings.push(`${label}: a data é anterior ao primeiro aporte histórico considerado (${formatDateForDisplay(firstHistoricalDate)}).`);
    }

    if (viewType === 'by_members' && flow.memberId && selectedMemberIds.length > 0 && !selectedMemberIds.includes(flow.memberId)) {
      warnings.push(`${label}: o membro informado não está entre os membros selecionados e o aporte será ignorado no cálculo.`);
    }
  });

  return { errors, warnings };
}

function buildXnpv(flows: XirrCashFlow[], rate: number): number {
  const baseDate = flows[0].date;

  return flows.reduce((total, flow) => {
    const years = diffDays(baseDate, flow.date) / 365;
    return total + flow.amount / Math.pow(1 + rate, years);
  }, 0);
}

function buildXnpvDerivative(flows: XirrCashFlow[], rate: number): number {
  const baseDate = flows[0].date;

  return flows.reduce((total, flow) => {
    const years = diffDays(baseDate, flow.date) / 365;
    if (years === 0) {
      return total;
    }

    return total - (years * flow.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

export function calculateXirr(flows: XirrCashFlow[]): number | null {
  if (flows.length < 2) {
    return null;
  }

  const sortedFlows = [...flows].sort((left, right) => left.date.localeCompare(right.date));
  const hasPositive = sortedFlows.some((flow) => flow.amount > 0);
  const hasNegative = sortedFlows.some((flow) => flow.amount < 0);

  if (!hasPositive || !hasNegative) {
    return null;
  }

  let guess = 0.1;
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const value = buildXnpv(sortedFlows, guess);
    const derivative = buildXnpvDerivative(sortedFlows, guess);

    if (!Number.isFinite(value) || !Number.isFinite(derivative) || Math.abs(derivative) < 1e-10) {
      break;
    }

    const nextGuess = guess - value / derivative;
    if (nextGuess <= -0.999999 || !Number.isFinite(nextGuess)) {
      break;
    }

    if (Math.abs(nextGuess - guess) < 1e-10) {
      return nextGuess;
    }

    guess = nextGuess;
  }

  const searchPoints = [-0.9999, -0.9, -0.75, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  let low = searchPoints[0];
  let high = searchPoints[searchPoints.length - 1];
  let bracketFound = false;

  for (let index = 0; index < searchPoints.length - 1; index += 1) {
    const left = searchPoints[index];
    const right = searchPoints[index + 1];
    const leftValue = buildXnpv(sortedFlows, left);
    const rightValue = buildXnpv(sortedFlows, right);

    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      continue;
    }

    if (leftValue === 0) {
      return left;
    }

    if (rightValue === 0) {
      return right;
    }

    if (leftValue * rightValue < 0) {
      low = left;
      high = right;
      bracketFound = true;
      break;
    }
  }

  if (!bracketFound) {
    return null;
  }

  let lowValue = buildXnpv(sortedFlows, low);

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (low + high) / 2;
    const midValue = buildXnpv(sortedFlows, mid);

    if (!Number.isFinite(midValue)) {
      return null;
    }

    if (Math.abs(midValue) < 1e-7) {
      return mid;
    }

    if (lowValue * midValue < 0) {
      high = mid;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

export function computeProjectProfitabilityReport({
  projectName,
  viewType,
  selectedMemberIds,
  exitDate,
  lucroLiquido,
  realFlows,
  futureFlows,
  members,
}: ProfitabilityComputationInput): ProfitabilityReportResult | null {
  const selectedMemberSet = new Set(selectedMemberIds);
  const selectedMembers = viewType === 'by_members'
    ? members.filter((member) => selectedMemberSet.has(member.id))
    : members;
  const selectedMemberNames = selectedMembers.map((member) => member.nome);
  const percentualTotalConsiderado = viewType === 'by_members'
    ? selectedMembers.reduce((total, member) => total + toNumber(member.percentage), 0)
    : null;

  const filteredRealFlows = realFlows.filter((flow) => (
    viewType === 'project_total' || selectedMemberSet.has(flow.membro_id)
  ));

  let ignoredFutureFlowCount = 0;
  const filteredFutureFlows = futureFlows.filter((flow) => {
    if (viewType === 'project_total') {
      return true;
    }

    const shouldInclude = !!flow.memberId && selectedMemberSet.has(flow.memberId);
    if (!shouldInclude) {
      ignoredFutureFlowCount += 1;
    }
    return shouldInclude;
  });

  if (filteredRealFlows.length === 0 && filteredFutureFlows.length === 0) {
    return null;
  }

  const lucroConsiderado = viewType === 'by_members'
    ? lucroLiquido * ((percentualTotalConsiderado ?? 0) / 100)
    : lucroLiquido;

  const realFlowRows: ProfitabilityFlowRow[] = filteredRealFlows.map((flow) => ({
    id: `real-${flow.fluxo_real_id}`,
    type: 'real_aporte',
    typeLabel: 'Aporte real',
    date: flow.data_fluxo,
    memberId: flow.membro_id,
    memberName: flow.membro_nome || '-',
    participationPercentage: toNumber(flow.percentage),
    amount: toNumber(flow.valor),
    signedAmount: -Math.abs(toNumber(flow.valor)),
    daysToExit: diffDays(flow.data_fluxo, exitDate),
    equivalentYears: diffDays(flow.data_fluxo, exitDate) / 365,
    observation: flow.observacoes || flow.numero_documento || '',
  }));

  const futureFlowRows: ProfitabilityFlowRow[] = filteredFutureFlows.map((flow) => {
    const linkedMember = members.find((member) => member.id === flow.memberId) ?? null;

    return {
      id: flow.id,
      type: 'future_aporte',
      typeLabel: 'Aporte futuro',
      date: flow.date,
      memberId: flow.memberId,
      memberName: linkedMember?.nome || '-',
      participationPercentage: linkedMember?.percentage ?? null,
      amount: Math.abs(flow.amount),
      signedAmount: -Math.abs(flow.amount),
      daysToExit: diffDays(flow.date, exitDate),
      equivalentYears: diffDays(flow.date, exitDate) / 365,
      observation: flow.note || '',
    };
  });

  const allNegativeFlows = [...realFlowRows, ...futureFlowRows].sort((left, right) => (
    left.date.localeCompare(right.date) || left.typeLabel.localeCompare(right.typeLabel)
  ));

  const totalInvestidoReal = realFlowRows.reduce((total, flow) => total + flow.amount, 0);
  const totalAportesFuturos = futureFlowRows.reduce((total, flow) => total + flow.amount, 0);
  const totalInvestidoGeral = totalInvestidoReal + totalAportesFuturos;
  const valorSaida = totalInvestidoGeral + lucroConsiderado;
  const firstFlowDate = allNegativeFlows[0]?.date;

  if (!firstFlowDate) {
    return null;
  }

  const diasTotal = diffDays(firstFlowDate, exitDate);
  const rentabilidadeSimples = totalInvestidoGeral > 0 ? lucroConsiderado / totalInvestidoGeral : null;

  const xirrFlows: XirrCashFlow[] = [
    ...allNegativeFlows.map((flow) => ({ amount: flow.signedAmount, date: flow.date })),
    { amount: valorSaida, date: exitDate },
  ];

  const tirAnual = totalInvestidoGeral > 0 ? calculateXirr(xirrFlows) : null;
  const taxaEquivalentePeriodo = tirAnual !== null
    ? Math.pow(1 + tirAnual, diasTotal / 365) - 1
    : null;

  const exitFlowRow: ProfitabilityFlowRow = {
    id: 'exit-flow',
    type: 'exit',
    typeLabel: 'Saída final',
    date: exitDate,
    memberId: null,
    memberName: viewType === 'by_members' ? selectedMemberNames.join(', ') || '-' : 'Projeto',
    participationPercentage: percentualTotalConsiderado,
    amount: valorSaida,
    signedAmount: valorSaida,
    daysToExit: 0,
    equivalentYears: 0,
    observation: `Lucro considerado: ${lucroConsiderado.toFixed(2)}`,
  };

  const warnings: string[] = [];
  if (ignoredFutureFlowCount > 0) {
    warnings.push(`${ignoredFutureFlowCount} aporte(s) futuro(s) não entraram no cálculo por não pertencerem aos membros selecionados.`);
  }

  if (tirAnual === null) {
    warnings.push('Não foi possível calcular a TIR para os fluxos informados.');
  }

  return {
    projectName,
    viewType,
    selectedMemberNames,
    exitDate,
    lucroLiquidoInformado: lucroLiquido,
    lucroConsiderado,
    percentualTotalConsiderado,
    totalInvestidoReal,
    totalAportesFuturos,
    totalInvestidoGeral,
    valorSaida,
    rentabilidadeSimples,
    tirAnual,
    taxaEquivalentePeriodo,
    diasTotal,
    firstFlowDate,
    flows: [...allNegativeFlows, exitFlowRow],
    warnings,
    ignoredFutureFlowCount,
  };
}
