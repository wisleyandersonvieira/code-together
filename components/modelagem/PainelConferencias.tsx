'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conferencia, Semaforo } from '@/lib/modelagem';

const ESTILO: Record<Semaforo, { card: string; icone: string; rotulo: string }> = {
  verde: {
    card: 'border-emerald-200 bg-emerald-50/60',
    icone: 'text-emerald-600',
    rotulo: 'text-emerald-700',
  },
  ambar: {
    card: 'border-amber-200 bg-amber-50/70',
    icone: 'text-amber-600',
    rotulo: 'text-amber-700',
  },
  vermelho: {
    card: 'border-red-200 bg-red-50/70',
    icone: 'text-red-600',
    rotulo: 'text-red-700',
  },
};

const Icone = ({ semaforo, className }: { semaforo: Semaforo; className?: string }) => {
  if (semaforo === 'verde') return <CheckCircle2 className={className} />;
  if (semaforo === 'ambar') return <AlertTriangle className={className} />;
  return <XCircle className={className} />;
};

/**
 * Conferências nunca bloqueiam o cálculo — só sinalizam. Por isso o painel
 * mostra TODAS, inclusive as verdes: é um painel de auditoria, não de erros.
 */
export function PainelConferencias({
  conferencias,
  compacto = false,
}: {
  conferencias: Conferencia[];
  compacto?: boolean;
}) {
  const problemas = conferencias.filter((c) => c.semaforo !== 'verde');
  const visiveis = compacto ? problemas : conferencias;

  if (compacto && problemas.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium">
          {conferencias.length} conferências, todas verdes.
        </span>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3', compacto ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3')}>
      {visiveis.map((c) => {
        const estilo = ESTILO[c.semaforo];
        return (
          <div key={c.chave} className={cn('rounded-2xl border p-4 shadow-sm', estilo.card)}>
            <div className="flex items-start gap-3">
              <Icone semaforo={c.semaforo} className={cn('mt-0.5 h-5 w-5 shrink-0', estilo.icone)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold text-slate-900">{c.titulo}</p>
                  <p className={cn('text-sm font-semibold tabular-nums', estilo.rotulo)}>{c.valor}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{c.detalhe}</p>
                {c.semaforo !== 'verde' ? (
                  <p className="mt-2 border-t border-slate-200/70 pt-2 text-xs leading-5 text-slate-500">
                    {c.comoResolver}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
