import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export const formShellClassName = 'space-y-6';
export const formSectionCardClassName =
  'rounded-3xl border border-slate-200/80 bg-white shadow-sm';
export const formFieldClassName =
  'h-11 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';
export const formTextareaClassName =
  'min-h-[110px] rounded-2xl border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200/60';
export const formSelectTriggerClassName = formFieldClassName;
export const formTabsListClassName =
  'grid h-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1';
export const formTabsTriggerClassName =
  'rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm';
export const formPrimaryButtonClassName =
  'h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md';
export const formSecondaryButtonClassName =
  'h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';
export const formMutedPanelClassName =
  'rounded-2xl border border-slate-200 bg-slate-50/70 p-4';

export function FormPageHeader({
  title,
  description,
  onBack,
}: {
  title: string;
  description?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        ) : null}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function FormSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(formSectionCardClassName, className)}>
      <CardHeader className="border-b border-slate-200/80 bg-slate-50/70">
        <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}
