'use client';

import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { FinanceStatusBadge } from '@/components/finance/listing-ui';
import { cn } from '@/lib/utils';
import { formatDateForDisplay } from '@/utils/timezone';

export type EtapaStatus =
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_CLIENTE'
  | 'AGUARDANDO_ORGAO'
  | 'CONCLUIDA'
  | 'NAO_APLICAVEL';

export type CompetenciaStatus =
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_CLIENTE'
  | 'AGUARDANDO_ORGAO'
  | 'ENTREGUE'
  | 'DISPENSADA';

export type EntityType = 'cliente' | 'empresa' | 'grupo';

export const entityTypeLabels: Record<EntityType, string> = {
  cliente: 'Cliente',
  empresa: 'Empresa',
  grupo: 'Grupo',
};

export const operacaoStatusLabels: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_CLIENTE: 'Aguardando cliente',
  AGUARDANDO_ORGAO: 'Aguardando órgão',
  CONCLUIDA: 'Concluída',
  NAO_APLICAVEL: 'Não aplicável',
  ENTREGUE: 'Entregue',
  DISPENSADA: 'Dispensada',
};

export const etapaStatusOptions: Array<{ value: EtapaStatus; label: string }> = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'AGUARDANDO_CLIENTE', label: 'Aguardando cliente' },
  { value: 'AGUARDANDO_ORGAO', label: 'Aguardando órgão' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'NAO_APLICAVEL', label: 'Não aplicável' },
];

export const competenciaStatusOptions: Array<{ value: CompetenciaStatus; label: string }> = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'AGUARDANDO_CLIENTE', label: 'Aguardando cliente' },
  { value: 'AGUARDANDO_ORGAO', label: 'Aguardando órgão' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'DISPENSADA', label: 'Dispensada' },
];

export const periodicidadeLabels: Record<string, string> = {
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

export const mesesLabels = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function isAguardando(status?: string | null) {
  return status === 'AGUARDANDO_CLIENTE' || status === 'AGUARDANDO_ORGAO';
}

export function operacaoStatusTone(status?: string | null) {
  if (status === 'CONCLUIDA' || status === 'ENTREGUE') return 'success' as const;
  if (status === 'EM_ANDAMENTO') return 'brand' as const;
  if (isAguardando(status)) return 'warning' as const;
  return 'neutral' as const;
}

/** O badge de status aceita apenas os tons do kit financeiro. */
export function OperacaoStatusBadge({ status }: { status?: string | null }) {
  const tone = operacaoStatusTone(status);
  return (
    <FinanceStatusBadge
      label={operacaoStatusLabels[String(status)] ?? String(status ?? '-')}
      tone={tone === 'brand' ? 'neutral' : tone}
    />
  );
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Traduz o prazo em uma frase que cobra. Quando a tarefa está aguardando
 * terceiros o relógio aparece explicitamente pausado — é o que impede o painel
 * de acusar a equipe por um atraso que não é dela.
 */
export function PrazoBadge({
  dataLimite,
  diasAtraso,
  aguardando,
}: {
  dataLimite?: string | null;
  diasAtraso?: number | string | null;
  aguardando?: boolean;
}) {
  if (aguardando) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        SLA pausado
      </span>
    );
  }

  if (!dataLimite) {
    return <span className="text-xs text-slate-400">Sem prazo</span>;
  }

  const dias = toOptionalNumber(diasAtraso);

  if (dias === null) {
    return <span className="text-xs text-slate-500">{formatDateForDisplay(dataLimite)}</span>;
  }

  const classes =
    dias > 0
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : dias === 0
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : dias >= -7
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-slate-100 text-slate-600';

  const texto =
    dias > 0
      ? `${dias} ${dias === 1 ? 'dia' : 'dias'} em atraso`
      : dias === 0
        ? 'Vence hoje'
        : `Em ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold', classes)}>
        {texto}
      </span>
      <span className="text-[11px] text-slate-400">{formatDateForDisplay(dataLimite)}</span>
    </span>
  );
}

interface ResumoCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: 'danger' | 'warning' | 'brand' | 'neutral';
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}

const resumoToneClasses = {
  danger: 'border-rose-200 bg-rose-50/60 text-rose-700',
  warning: 'border-amber-200 bg-amber-50/60 text-amber-700',
  brand: 'border-sky-200 bg-sky-50/60 text-sky-700',
  neutral: 'border-slate-200 bg-white text-slate-700',
} as const;

export function ResumoCard({ label, value, icon: Icon, tone = 'neutral', hint, active, onClick }: ResumoCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'rounded-2xl border shadow-sm transition-all duration-200',
        resumoToneClasses[tone],
        onClick && 'cursor-pointer hover:shadow-md',
        active && 'ring-2 ring-slate-900/70 ring-offset-1',
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="text-2xl font-bold leading-none">{value}</p>
          {hint ? <p className="text-[11px] opacity-70">{hint}</p> : null}
        </div>
        <Icon className="h-5 w-5 shrink-0 opacity-70" />
      </CardContent>
    </Card>
  );
}

export function ChecklistProgress({
  total,
  concluidos,
}: {
  total?: number | string | null;
  concluidos?: number | string | null;
}) {
  const totalNum = toNumber(total);
  const feitos = toNumber(concluidos);

  if (totalNum === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const completo = feitos >= totalNum;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        completo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {feitos}/{totalNum} checklist
    </span>
  );
}

export function OperacaoSectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
