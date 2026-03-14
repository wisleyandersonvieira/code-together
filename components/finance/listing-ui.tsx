import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const statusToneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
} as const;

const actionToneClasses = {
  neutral: 'text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800',
  brand: 'text-sky-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700',
  success: 'text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700',
  warning: 'text-amber-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700',
  danger: 'text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700',
} as const;

type StatusTone = keyof typeof statusToneClasses;
type ActionTone = keyof typeof actionToneClasses;

export const listingPrimaryButtonClassName =
  'h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md';

export const listingSecondaryButtonClassName =
  'h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

export const listingFilterFieldClassName =
  'h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';

export const listingTableCardClassName =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm';

export const listingTableHeadClassName =
  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600';

export const listingTableCellClassName =
  'px-4 py-3.5 align-middle text-sm text-slate-600';

export function ListingPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ListingFilterCard({ children }: { children: ReactNode }) {
  return (
    <Card className="border border-slate-200/80 bg-white shadow-sm">
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function ListingTableCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn(listingTableCardClassName, className)}>{children}</Card>;
}

export function ListingFilterBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
    >
      {children}
    </Badge>
  );
}

export function ListingEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-14 text-center">
      <div className="flex flex-col items-center">
        <Icon className="mb-4 h-12 w-12 text-slate-300" />
        <h3 className="mb-2 text-lg font-medium text-slate-900">{title}</h3>
        <p className="mb-4 max-w-xl text-sm text-slate-500">{description}</p>
        {action}
      </div>
    </div>
  );
}

export function FinanceStatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-3 py-1 text-xs font-semibold tracking-[0.01em] shadow-sm',
        statusToneClasses[tone],
      )}
    >
      {label}
    </Badge>
  );
}

interface FinanceActionButtonProps {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  tone?: ActionTone;
}

export function FinanceActionButton({
  icon: Icon,
  title,
  onClick,
  tone = 'neutral',
}: FinanceActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className={cn(
        'h-8 w-8 rounded-lg border border-slate-200 bg-white p-0 shadow-sm transition-all duration-200',
        actionToneClasses[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
