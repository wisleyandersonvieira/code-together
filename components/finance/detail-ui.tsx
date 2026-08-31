import * as React from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const financeDetailFieldClassName =
  'h-11 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';

export const financeDetailTextareaClassName =
  'min-h-[120px] rounded-2xl border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';

export const financeDetailMutedPanelClassName =
  'rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm';

export const financeDetailCardClassName =
  'overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/95 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.38)]';

export const financeDetailCardHeaderClassName =
  'border-b border-slate-100 bg-gradient-to-r from-white via-slate-50/60 to-white px-6 py-5 sm:px-7';

export const financeDetailCardContentClassName = 'px-6 py-6 sm:px-7';

export const financeDetailTableWrapClassName =
  'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm';

export const financeDetailTabsListClassName =
  'grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50/85 p-2 shadow-sm md:grid-cols-5';

export const financeDetailTabsTriggerClassName =
  'min-h-[46px] rounded-xl border border-slate-700/70 bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.7)]';

/**
 * Mesma aparência da versão acima, com menos volume: para telas com muitas abas,
 * onde a altura de 46px empurra o conteúdo para fora da dobra.
 *
 * É uma constante SEPARADA de propósito. `financeDetailTabsTriggerClassName` é
 * compartilhada com as demais telas financeiras, e encolher lá mudaria todas de
 * uma vez — a decisão de densidade é de cada tela, não do design system.
 */
export const financeDetailTabsTriggerCompactClassName =
  'min-h-[38px] rounded-lg border border-slate-700/70 bg-slate-700 px-3 py-2 text-[13px] font-semibold text-white transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.7)]';

interface FinanceDetailHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

export function FinanceDetailHeader({ title, subtitle, onBack }: FinanceDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/70 p-5 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.45)] sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="flex items-start gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-11 rounded-xl border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Provision</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

interface FinanceDetailSectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FinanceDetailSectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: FinanceDetailSectionCardProps) {
  return (
    <Card className={cn(financeDetailCardClassName, className)}>
      <CardHeader
        className={cn(
          financeDetailCardHeaderClassName,
          action && 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        )}
      >
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-sm leading-6 text-slate-500">{description}</CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn(financeDetailCardContentClassName, contentClassName)}>{children}</CardContent>
    </Card>
  );
}
