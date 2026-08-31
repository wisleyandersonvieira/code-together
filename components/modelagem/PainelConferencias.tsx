'use client';

import { useEffect, useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, XCircle } from 'lucide-react';
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

/** Mais severo primeiro. É a ordem de leitura e a de ordenação do grid. */
const SEVERIDADE: Record<Semaforo, number> = { vermelho: 0, ambar: 1, verde: 2 };

const ROTULO_CONTAGEM: Record<Semaforo, string> = {
  verde: 'OK',
  ambar: 'atenção',
  vermelho: 'crítico',
};

/**
 * A barra recolhida NÃO pode parecer saudável quando não está: a cor segue
 * sempre a pior conferência da lista, não a maioria.
 */
const pior = (lista: Conferencia[]): Semaforo =>
  lista.some((c) => c.semaforo === 'vermelho')
    ? 'vermelho'
    : lista.some((c) => c.semaforo === 'ambar')
      ? 'ambar'
      : 'verde';

const CHAVE_STORAGE = 'provison:modelagem:painel-validacao';

/**
 * Preferência de expandido do painel do rodapé.
 *
 * localStorage pode estar bloqueado — janela anônima com cookies desativados,
 * política corporativa, modo privado do Safari com cota estourada — e o acesso
 * então LANÇA, não devolve null. Por isso leitura e escrita são as duas
 * protegidas, e o padrão de qualquer falha é recolhido: a tela nunca quebra por
 * causa de uma preferência de interface.
 */
const lerPreferencia = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(CHAVE_STORAGE) === '1';
  } catch {
    return false;
  }
};

const gravarPreferencia = (aberto: boolean) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHAVE_STORAGE, aberto ? '1' : '0');
  } catch {
    // Preferência de interface não vale uma exceção na tela.
  }
};

/** Grid de cards — o mesmo estilo de sempre, só reordenado por severidade. */
function GradeConferencias({
  conferencias,
  colunas,
}: {
  conferencias: Conferencia[];
  colunas: 'uma' | 'muitas';
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        colunas === 'uma' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {conferencias.map((c) => {
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

/**
 * Chevron que gira 180° ao abrir.
 *
 * `motion-reduce:transition-none` respeita prefers-reduced-motion: quem pediu
 * menos movimento vê o chevron trocar de posição sem animação.
 */
const Chevron = ({ aberto }: { aberto: boolean }) => (
  <ChevronDown
    aria-hidden="true"
    className={cn(
      'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none',
      aberto && 'rotate-180',
    )}
  />
);

/** Foco visível em teclado. A barra inteira é o botão, então o anel vai nela. */
const FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

/**
 * Conferências nunca bloqueiam o cálculo — só sinalizam. Por isso o painel
 * mostra TODAS, inclusive as verdes: é um painel de auditoria, não de erros.
 *
 * Dois modos, e o estado de expandido de cada um é SÓ de interface — não vai
 * para o banco, não entra no ModelInput, não aparece no diff de salvamento:
 *
 *   `compacto` — a notificação do topo. Só existe quando há problema; some
 *     inteira quando está tudo verde, porque a barra do rodapé já diz isso.
 *   padrão — a barra do rodapé, com as contagens. Recolhida por default, e a
 *     preferência do usuário fica em localStorage.
 */
export function PainelConferencias({
  conferencias,
  compacto = false,
  bloqueios = [],
}: {
  conferencias: Conferencia[];
  compacto?: boolean;
  /** De `bloqueiaSalvamento`. Quando há, a notificação nasce aberta e vermelha. */
  bloqueios?: Conferencia[];
}) {
  const idConteudo = useId();
  const problemas = conferencias.filter((c) => c.semaforo !== 'verde');

  // Ordenado por severidade: hoje a ordem é a de inserção, e a crítica pode cair
  // no meio do grid. `sort` é estável, então dentro de cada semáforo a ordem
  // original — que é a do motor, e tem uma lógica — se mantém.
  const ordenadas = [...conferencias].sort(
    (a, b) => SEVERIDADE[a.semaforo] - SEVERIDADE[b.semaforo],
  );
  const problemasOrdenados = ordenadas.filter((c) => c.semaforo !== 'verde');

  const temBloqueio = bloqueios.length > 0;
  // Bloqueio de salvamento nasce ABERTO: hoje o motivo só aparece no toast,
  // depois de o usuário tentar salvar e falhar.
  const [aberto, setAberto] = useState(() =>
    compacto ? temBloqueio : lerPreferencia(),
  );

  // Quando um bloqueio aparece com a notificação recolhida, ela reabre sozinha —
  // é a única situação em que a tela decide por cima da escolha do usuário, e é
  // porque o botão Salvar acabou de ficar desabilitado sem explicação visível.
  useEffect(() => {
    if (compacto && temBloqueio) setAberto(true);
  }, [compacto, temBloqueio]);

  useEffect(() => {
    if (!compacto) gravarPreferencia(aberto);
  }, [compacto, aberto]);

  // ─── Notificação do topo ───────────────────────────────────────────────────
  if (compacto) {
    // Sem problema nenhum não há o que notificar. A faixa "N conferências, todas
    // verdes" gastava uma dobra inteira para dizer que está tudo bem.
    if (problemas.length === 0) return null;

    const severidade = temBloqueio ? 'vermelho' : pior(problemas);
    const estilo = ESTILO[severidade];
    const primeira = problemasOrdenados[0];

    return (
      <div className={cn('overflow-hidden rounded-xl border', estilo.card)}>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls={idConteudo}
          className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left', FOCO)}
        >
          <Icone semaforo={severidade} className={cn('h-4 w-4 shrink-0', estilo.icone)} />
          <span className={cn('shrink-0 text-sm font-medium', estilo.rotulo)}>
            <span className="tabular-nums">{problemas.length}</span>{' '}
            {problemas.length === 1 ? 'validação precisa' : 'validações precisam'} de atenção
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{primeira?.titulo}</span>
          <Chevron aberto={aberto} />
        </button>

        <div id={idConteudo} hidden={!aberto} className="border-t border-slate-200/70 px-4 py-3">
          {temBloqueio ? (
            <p className="mb-3 text-sm font-semibold text-red-700">
              O salvamento está bloqueado até resolver:
            </p>
          ) : null}
          {/* Só as não-verdes, com o `comoResolver` de cada uma — que é a
              informação útil e hoje só aparece no painel do rodapé. */}
          <GradeConferencias conferencias={problemasOrdenados} colunas="uma" />
        </div>
      </div>
    );
  }

  // ─── Barra do rodapé ───────────────────────────────────────────────────────
  const contagens = (['verde', 'ambar', 'vermelho'] as const)
    .map((s) => ({ semaforo: s, n: conferencias.filter((c) => c.semaforo === s).length }))
    // Contagem zerada não aparece: "0 crítico" é ruído.
    .filter((x) => x.n > 0)
    .sort((a, b) => SEVERIDADE[a.semaforo] - SEVERIDADE[b.semaforo]);

  const severidade = pior(conferencias);
  const estilo = ESTILO[severidade];
  const maisSevera = problemasOrdenados[0];

  return (
    <div className={cn('overflow-hidden rounded-xl border', estilo.card)}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idConteudo}
        className={cn('flex w-full items-center gap-4 px-4 py-2.5 text-left', FOCO)}
      >
        <span className="flex shrink-0 items-center gap-3">
          {contagens.map((x) => (
            <span key={x.semaforo} className="flex items-center gap-1.5">
              <Icone semaforo={x.semaforo} className={cn('h-4 w-4', ESTILO[x.semaforo].icone)} />
              <span className={cn('text-sm font-medium', ESTILO[x.semaforo].rotulo)}>
                <span className="tabular-nums">{x.n}</span> {ROTULO_CONTAGEM[x.semaforo]}
              </span>
            </span>
          ))}
        </span>

        {/* Recolhida, a barra ainda informa QUAL é o problema mais grave. */}
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
          {maisSevera?.titulo ?? ''}
        </span>

        <span className="sr-only">{aberto ? 'Recolher painel' : 'Expandir painel'}</span>
        <Chevron aberto={aberto} />
      </button>

      <div
        id={idConteudo}
        hidden={!aberto}
        className="border-t border-slate-200/70 bg-white/60 px-4 py-4"
      >
        <GradeConferencias conferencias={ordenadas} colunas="muitas" />
      </div>
    </div>
  );
}
