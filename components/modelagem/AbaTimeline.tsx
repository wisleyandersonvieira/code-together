'use client';

import { cn } from '@/lib/utils';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { facilidadePrincipal } from '@/lib/modelagem';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';
import { dinheiro, mesAno } from './formato';

interface Props {
  rascunho: ModelInput;
  resultado: ModelOutput;
  /** Leva o clique para a aba que edita aquele input. A tela é para ler, não editar. */
  irParaAba: (aba: string) => void;
}

/**
 * Paleta das fases. Cores de série, não semânticas: a fase 1 não é "melhor" que a
 * 2. Escolhidas para manter contraste sobre a barra e legíveis lado a lado; o
 * ciclo se repete a partir da sexta fase.
 */
const CORES_FASE = ['#1C4E7A', '#2E7D6B', '#8A5A2B', '#5B4B8A', '#A03E52'];

/** Uma barra da régua, já em porcentagem sobre o prazo total. */
interface Barra {
  rotulo: string;
  /** Posição e largura em % do prazo total — o que `faixa` devolve. */
  left: number;
  width: number;
  cor: string;
  titulo: string;
  aoClicar?: () => void;
}

export function AbaTimeline({ rascunho, resultado, irParaAba }: Props) {
  const cr = resultado.cronograma;
  const prazo = cr.prazoTotal;
  const moeda = rascunho.moeda;

  if (prazo <= 0) {
    return (
      <FinanceDetailSectionCard title="Linha do tempo" description="Como o projeto se distribui no tempo.">
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          O cronograma tem zero mês. Informe aprovação, construção e pós-obra na aba Premissas.
        </p>
      </FinanceDetailSectionCard>
    );
  }

  /** Posição de um intervalo de meses, em % do prazo total. Sempre 1..prazo. */
  const faixa = (mesInicio: number, mesFim: number) => {
    const i = Math.max(1, Math.min(Math.trunc(mesInicio), prazo));
    const f = Math.max(i, Math.min(Math.trunc(Math.max(mesFim, mesInicio)), prazo));
    return { left: ((i - 1) / prazo) * 100, width: ((f - i + 1) / prazo) * 100 };
  };

  /** Posição de um marcador pontual, no MEIO do mês. */
  const ponto = (mes: number) => ((Math.max(1, Math.min(mes, prazo)) - 0.5) / prazo) * 100;

  const dataDoMes = (mes: number) =>
    resultado.meses[mes - 1] ? mesAno(resultado.meses[mes - 1].data) : `mês ${mes}`;

  // ─── Trilha 1: cronograma global ───────────────────────────────────────────
  // O cronograma global é quem define o prazo; as fases se encaixam dentro dele.
  const cronogramaGlobal: Barra[] = [];
  if (rascunho.mesesAprovacao > 0) {
    cronogramaGlobal.push({
      rotulo: 'Aprovação',
      ...faixa(1, cr.mesInicioObra - 1),
      cor: '#94A3B8',
      titulo: `Aprovação · meses 1 a ${cr.mesInicioObra - 1} · ${dataDoMes(1)} a ${dataDoMes(cr.mesInicioObra - 1)}`,
    });
  }
  if (rascunho.mesesConstrucao > 0) {
    cronogramaGlobal.push({
      rotulo: 'Obra',
      ...faixa(cr.mesInicioObra, cr.mesFimObra),
      cor: '#1C4E7A',
      titulo: `Obra · meses ${cr.mesInicioObra} a ${cr.mesFimObra} · ${dataDoMes(cr.mesInicioObra)} a ${dataDoMes(cr.mesFimObra)} · ${dinheiro(resultado.agregados.obraTotal, moeda)}`,
    });
  }
  if (rascunho.mesesPosObra > 0) {
    cronogramaGlobal.push({
      rotulo: 'Pós-obra',
      ...faixa(cr.mesFimObra + 1, prazo),
      cor: '#CBD5E1',
      titulo: `Pós-obra · meses ${cr.mesFimObra + 1} a ${prazo} · ${dataDoMes(cr.mesFimObra + 1)} a ${dataDoMes(prazo)}`,
    });
  }

  // ─── Trilha 2: fases ───────────────────────────────────────────────────────
  // Vazia quando `usaFases` é false — e é justamente por isso que a régua não
  // quebra num projeto de frente única: a trilha simplesmente não é desenhada.
  const fases: Barra[] = rascunho.usaFases
    ? cr.fases.map((f, i) => ({
        rotulo: f.nome || `Fase ${i + 1}`,
        ...faixa(f.mesInicio, f.mesFim),
        cor: CORES_FASE[i % CORES_FASE.length],
        titulo: `${f.nome || `Fase ${i + 1}`} · ${f.dataInicio} a ${f.dataFim} · meses ${f.mesInicio} a ${f.mesFim}`,
        aoClicar: () => irParaAba('premissas'),
      }))
    : [];

  // ─── Trilha 3: takedowns ───────────────────────────────────────────────────
  // Um marcador por mês de venda, com a quantidade. Lotes no mesmo mês somam,
  // como o motor faz.
  const takedowns = rascunho.receita.takedowns ?? [];
  const vendasPorMes = new Map<number, { unidades: number; valor: number }>();
  if (rascunho.receita.modoVenda === 'takedown') {
    for (const t of takedowns) {
      const u = rascunho.unidades[t.unidadeIndex];
      if (!u || t.mes < 1 || t.mes > prazo) continue;
      const preco = t.precoUnitario > 0 ? t.precoUnitario : u.precoVenda || 0;
      const atual = vendasPorMes.get(t.mes) ?? { unidades: 0, valor: 0 };
      vendasPorMes.set(t.mes, {
        unidades: atual.unidades + Math.max(0, Math.trunc(t.quantidade || 0)),
        valor: atual.valor + preco * Math.max(0, Math.trunc(t.quantidade || 0)),
      });
    }
  }
  const marcadoresVenda = [...vendasPorMes.entries()].sort((a, b) => a[0] - b[0]);

  // ─── Trilha 4: marcos do financiamento ─────────────────────────────────────
  const fin = facilidadePrincipal(rascunho);
  const marcos = [
    { mes: fin.mesInicioSaque, rotulo: 'Início do saque', cor: '#2E7D6B' },
    { mes: fin.mesFimSaque, rotulo: 'Fim da janela de saque', cor: '#8A5A2B' },
    { mes: cr.mesSaida, rotulo: 'Saída', cor: '#A03E52' },
  ].filter((x) => x.mes >= 1 && x.mes <= prazo);

  // Régua de meses no topo. Com prazo longo, rotular todo mês vira borrão — um a
  // cada N mantém a leitura, e o passo sai do próprio prazo.
  const passo = prazo <= 24 ? 1 : prazo <= 48 ? 3 : 6;
  const marcasRegua = [];
  for (let m = 1; m <= prazo; m += passo) marcasRegua.push(m);

  const ROTULO = 'w-32 shrink-0 truncate pr-3 text-xs text-slate-600';

  const Trilha = ({ titulo, barras }: { titulo: string; barras: Barra[] }) =>
    barras.length === 0 ? null : (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
        {barras.map((b, i) => (
          <div key={`${b.rotulo}-${i}`} className="flex items-center">
            <span className={ROTULO}>{b.rotulo}</span>
            <div className="relative h-5 flex-1 rounded bg-slate-100">
              <div
                className={cn(
                  'absolute top-0.5 h-4 rounded-sm',
                  b.aoClicar && 'cursor-pointer hover:opacity-80',
                )}
                style={{ left: `${b.left}%`, width: `${b.width}%`, backgroundColor: b.cor }}
                title={b.titulo}
                onClick={b.aoClicar}
                role={b.aoClicar ? 'button' : undefined}
                tabIndex={b.aoClicar ? 0 : undefined}
                onKeyDown={(e) => {
                  if (b.aoClicar && (e.key === 'Enter' || e.key === ' ')) b.aoClicar();
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Linha do tempo"
        description="Cronograma, fases, vendas e marcos do financiamento sobre os mesmos meses. Tudo aqui é leitura — clique numa fase ou numa venda para ir ao lugar que a edita."
      >
        {/* Régua de meses. Fica no topo e vale para todas as trilhas abaixo. */}
        <div className="mb-4 flex items-end">
          <span className={ROTULO} />
          <div className="relative h-9 flex-1 border-b border-slate-300">
            {marcasRegua.map((m) => (
              <div
                key={m}
                className="absolute bottom-0 -translate-x-1/2 text-center"
                style={{ left: `${ponto(m)}%` }}
              >
                <span className="block text-[10px] font-medium tabular-nums text-slate-600">{m}</span>
                <span className="block text-[9px] text-slate-400">{dataDoMes(m)}</span>
                <span className="mx-auto block h-1.5 w-px bg-slate-300" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Trilha titulo="Cronograma" barras={cronogramaGlobal} />
          <Trilha titulo="Fases" barras={fases} />

          {marcadoresVenda.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Takedowns
              </p>
              <div className="flex items-center">
                <span className={ROTULO}>Unidades vendidas</span>
                <div className="relative h-9 flex-1 rounded bg-slate-100">
                  {marcadoresVenda.map(([mes, v]) => (
                    <div
                      key={mes}
                      className="absolute top-0 flex h-9 -translate-x-1/2 cursor-pointer flex-col items-center justify-center hover:opacity-70"
                      style={{ left: `${ponto(mes)}%` }}
                      title={`${dataDoMes(mes)} (mês ${mes}) · ${v.unidades} unidade(s) · ${dinheiro(v.valor, moeda)}`}
                      onClick={() => irParaAba('receita')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') irParaAba('receita');
                      }}
                    >
                      <span className="rounded bg-slate-800 px-1 text-[10px] font-semibold tabular-nums text-white">
                        {v.unidades}
                      </span>
                      <span className="h-3 w-px bg-slate-800" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {marcos.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Financiamento
              </p>
              <div className="flex items-center">
                <span className={ROTULO}>Marcos</span>
                <div className="relative h-9 flex-1 rounded bg-slate-100">
                  {marcos.map((x) => (
                    <div
                      key={x.rotulo}
                      className="absolute top-0 flex h-9 -translate-x-1/2 flex-col items-center justify-center"
                      style={{ left: `${ponto(x.mes)}%` }}
                      title={`${x.rotulo} · mês ${x.mes} · ${dataDoMes(x.mes)}`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: x.cor }}
                      />
                      <span className="h-4 w-px" style={{ backgroundColor: x.cor }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pl-32 pt-1">
                {marcos.map((x) => (
                  <span key={x.rotulo} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.cor }} />
                    {x.rotulo} · mês {x.mes}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {!rascunho.usaFases ? (
          <p className="mt-5 text-xs leading-5 text-slate-500">
            O projeto é de frente única — a trilha de fases só aparece com a divisão em fases ligada
            na aba Premissas.
          </p>
        ) : null}
        {rascunho.receita.modoVenda !== 'takedown' ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Os marcadores de venda só aparecem no modo de venda <em>takedown</em>, que é o único que
            distribui as unidades em lotes mensais.
          </p>
        ) : null}
      </FinanceDetailSectionCard>
    </div>
  );
}
