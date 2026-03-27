'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ProvisonLogo } from './ProvisonLogo';

interface AuthShellProps {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AuthShell({
  eyebrow = 'Acesso seguro',
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
}: AuthShellProps) {
  return (
    <Card
      className={cn(
        'relative w-full overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
      <CardContent className={cn('p-0', contentClassName)}>
        <div className="flex flex-col gap-8 p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-700" />
                {eyebrow}
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-3 shadow-[0_16px_30px_rgba(15,23,42,0.18)]">
                <ProvisonLogo className="h-10 w-10 sm:h-11 sm:w-11" />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.38em] text-slate-400">
                  Provision
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.2rem]">
                  {title}
                </h1>
              </div>
              {description && (
                <p className="max-w-md text-sm leading-6 text-slate-600 sm:text-[15px]">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div>{children}</div>

          {footer ? <div className="border-t border-slate-200/80 pt-5">{footer}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AuthField({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  error?: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        {hint ? <span className="text-xs font-medium text-slate-400">{hint}</span> : null}
      </div>
      {children}
      {error ? <div className="text-[0.8rem] font-medium text-rose-600">{error}</div> : null}
    </div>
  );
}

export const authInputClassName =
  'h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-slate-300 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-slate-200/70';

export const authPrimaryButtonClassName =
  'h-12 rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_22px_40px_rgba(15,23,42,0.2)] focus-visible:ring-4 focus-visible:ring-slate-200';

export const authSecondaryButtonClassName =
  'h-11 rounded-2xl border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

export const authGhostButtonClassName =
  'h-10 rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900';
