'use client';

import { useLoadAction } from '@uibakery/data';
import { AlertTriangle, Bell, CalendarClock, CalendarDays, PauseCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCurrentUser } from '@/lib/userContext';
import loadOperacaoResumoAction from '@/actions/loadOperacaoResumo';
import { toNumber } from '@/components/operacao/operacao-ui';
import { cn } from '@/lib/utils';

interface OperacaoAlertaSinoProps {
  onNavigate: (tab: 'operacao-minhas-tarefas' | 'operacao-painel') => void;
}

/**
 * O alerta que o módulo não tinha. Sem infraestrutura de e-mail nem cron, a
 * cobrança acontece na própria sessão: o número é recalculado por SQL a cada
 * carga da tela e leva direto para a lista que o originou.
 */
export function OperacaoAlertaSino({ onNavigate }: OperacaoAlertaSinoProps) {
  const currentUser = useCurrentUser();
  const meuId = currentUser?.legacy_user_id ? String(currentUser.legacy_user_id) : null;

  const [meuResumo] = useLoadAction(loadOperacaoResumoAction, [], { responsavelId: meuId ?? 'all' });
  const [geralResumo] = useLoadAction(loadOperacaoResumoAction, [], { responsavelId: 'all' });

  const meu = (Array.isArray(meuResumo) ? meuResumo[0] : null) ?? {};
  const geral = (Array.isArray(geralResumo) ? geralResumo[0] : null) ?? {};

  const minhasAtrasadas = meuId ? toNumber(meu.atrasadas) : 0;
  const minhasHoje = meuId ? toNumber(meu.vence_hoje) : 0;
  const contagem = minhasAtrasadas + minhasHoje;

  const linhasMinhas = [
    { icon: AlertTriangle, label: 'Atrasadas', valor: minhasAtrasadas, tone: 'text-rose-600' },
    { icon: CalendarDays, label: 'Vencem hoje', valor: minhasHoje, tone: 'text-amber-600' },
    { icon: CalendarClock, label: 'Próximos 7 dias', valor: meuId ? toNumber(meu.proximos_7) : 0, tone: 'text-sky-600' },
    {
      icon: PauseCircle,
      label: 'Aguardando terceiros',
      valor: meuId ? toNumber(meu.aguardando) : 0,
      tone: 'text-slate-500',
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Prazos da operação"
          className="relative h-10 w-10 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900"
        >
          <Bell className="h-4 w-4" />
          {contagem > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white shadow-sm">
              {contagem > 99 ? '99+' : contagem}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 rounded-2xl border-slate-200 p-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">No seu nome</p>
            <div className="mt-2 space-y-1.5">
              {linhasMinhas.map((linha) => (
                <div key={linha.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <linha.icon className={cn('h-4 w-4', linha.tone)} />
                    {linha.label}
                  </span>
                  <span className="font-semibold text-slate-900">{linha.valor}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Escritório em atraso</span>
              <span className="font-semibold text-rose-700">{toNumber(geral.atrasadas)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-600">Sem responsável</span>
              <span className="font-semibold text-slate-900">{toNumber(geral.sem_responsavel)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-9 flex-1 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
              onClick={() => onNavigate('operacao-minhas-tarefas')}
            >
              Minhas tarefas
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 rounded-xl border-slate-200 text-xs font-semibold"
              onClick={() => onNavigate('operacao-painel')}
            >
              Painel de prazos
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
