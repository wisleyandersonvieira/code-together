import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

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
