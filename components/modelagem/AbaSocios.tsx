'use client';

import { useId, useState } from 'react';
import { ChevronRight, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ModelInput, ModelOutput, Socio, SocioAporte } from '@/lib/modelagem';
import { EXPLICACAO_REGRA_CAPITAL, ROTULO_REGRA_CAPITAL, somarMeses } from '@/lib/modelagem';
import { dinheiro, mesAno, multiplo, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

/** Mesma lista do gerador de aportes: o usuário não aprende duas gramáticas. */
const PERIODICIDADES = [
  { valor: '1', rotulo: 'Mensal' },
  { valor: '2', rotulo: 'Bimestral' },
  { valor: '3', rotulo: 'Trimestral' },
  { valor: '6', rotulo: 'Semestral' },
];

/** Centavos, para a soma dos aportes fechar exatamente com o total pedido. */
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Divergência que já merece âmbar: 1 ponto percentual. Igual à conferência. */
const TOL_DIVERGENCIA = 0.01;

const celula = 'h-9 rounded-lg border-slate-200 bg-white px-2 text-right text-sm tabular-nums';
const cabecalho = 'px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const lido = 'bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700';

export function AbaSocios({ rascunho, alterar, resultado }: Props) {
  const socios = rascunho.socios ?? [];
  const moeda = rascunho.moeda;
  const prazoTotal = resultado.cronograma.prazoTotal;
  const soma = socios.reduce((a, s) => a + (s.participacaoPct || 0), 0);
  const somaOk = Math.abs(soma - 1) <= 0.0001;

  const regra = rascunho.aportes?.regraRateioCapital ?? 'participacao';
  const porCapital = regra === 'pct_capital';
  const porCronograma = regra === 'cronograma_socio';

  const mudar = (i: number, patch: Partial<Socio>) =>
    alterar({ socios: socios.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const rec = rascunho.receita;
  const somaLucro = (rec.lucroInvestidoresPct || 0) + (rec.lucroSponsorPct || 0);
  const lucroOk = Math.abs(somaLucro - 1) <= 0.0001;

  const dataDoMes = (mes: number) => mesAno(somarMeses(rascunho.dataInicio, Math.max(1, mes) - 1));

  /** Soma dos percentuais de capital, com a herança da participação embutida. */
  const somaCapital = socios.reduce((a, s) => a + (s.pctCapital ?? s.participacaoPct ?? 0), 0);
  const capitalOk = Math.abs(somaCapital - 1) <= 0.0001;

  // ─── Aportes por sócio ─────────────────────────────────────────────────────
  // Estado SÓ de interface: não vai para o banco, não entra no ModelInput.
  const idBase = useId();
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const alternar = (i: number) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(i)) proximo.delete(i);
      else proximo.add(i);
      return proximo;
    });

  const [geradores, setGeradores] = useState<
    Record<number, { total: number; quantidade: number; mesInicial: number; passo: string }>
  >({});
  const geradorDe = (i: number) =>
    geradores[i] ?? { total: 0, quantidade: 4, mesInicial: 1, passo: '1' };
  const mudarGerador = (i: number, patch: Partial<ReturnType<typeof geradorDe>>) =>
    setGeradores((atual) => ({ ...atual, [i]: { ...geradorDe(i), ...patch } }));

  /** Sempre por mês: a tabela não tem outra ordem possível. */
  const aportesDe = (s: Socio) =>
    [...(s.aportes ?? [])].sort((a, b) => a.mes - b.mes || a.ordem - b.ordem);

  /** Grava já reordenado e renumerando `ordem` — o índice é a ordem no banco. */
  const gravarAportes = (i: number, novos: SocioAporte[]) =>
    mudar(i, {
      aportes: [...novos]
        .sort((a, b) => a.mes - b.mes || a.ordem - b.ordem)
        .map((a, k) => ({ ...a, ordem: k })),
    });

  const mudarAporte = (i: number, alvo: SocioAporte, patch: Partial<SocioAporte>) =>
    gravarAportes(
      i,
      aportesDe(socios[i]).map((a) => (a === alvo ? { ...a, ...patch } : a)),
    );

  /**
   * Dois aportes no mesmo mês NÃO são erro — a tabela não tem UNIQUE (socio_id,
   * mes) e o motor soma —, então o mês seguinte ao último é só conveniência.
   */
  const adicionarAporte = (i: number) => {
    const atuais = aportesDe(socios[i]);
    const ultimo = atuais.length > 0 ? atuais[atuais.length - 1].mes : 0;
    gravarAportes(i, [...atuais, { ordem: atuais.length, mes: Math.max(1, ultimo + 1), valor: 0 }]);
  };

  /**
   * Divide o total igualmente e joga o resíduo do arredondamento no ÚLTIMO
   * aporte: a soma fecha no centavo com o total pedido, sempre. Mesmo gerador da
   * aba Aportes.
   */
  const gerar = (i: number) => {
    const g = geradorDe(i);
    const n = Math.max(1, Math.trunc(g.quantidade) || 1);
    const passo = Math.max(1, Number(g.passo) || 1);
    const inicio = Math.max(1, Math.trunc(g.mesInicial) || 1);
    const total = g.total || 0;

    const fatia = centavos(total / n);
    const novos: SocioAporte[] = [];
    for (let k = 0; k < n; k++) {
      novos.push({
        ordem: k,
        mes: inicio + k * passo,
        valor: k === n - 1 ? centavos(total - fatia * (n - 1)) : fatia,
      });
    }

    const fora = novos.filter((a) => a.mes > prazoTotal);
    if (
      fora.length > 0 &&
      !window.confirm(
        `${fora.length} aporte(s) caem além do mês ${prazoTotal}, o fim do cronograma, e não entram no fluxo. ` +
          'Gerar assim mesmo? (a conferência vai acusar)',
      )
    ) {
      return;
    }
    const existentes = (socios[i].aportes ?? []).length;
    if (
      existentes > 0 &&
      !window.confirm(`Isto substitui os ${existentes} aportes já lançados. Continuar?`)
    ) {
      return;
    }
    gravarAportes(i, novos);
  };

  const adicionarSocio = () =>
    alterar({
      socios: [
        ...socios,
        {
          nome: '',
          participacaoPct: 0,
          cotaDisponivel: false,
          // `null` = herda a participação, que é o comportamento de sempre.
          pctCapital: null,
          aportes: [],
        },
      ],
    });

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Sócios"
        description="A participação governa o LUCRO. O capital pode seguir outra regra — escolhida na aba Aportes —, e é essa diferença que faz a TIR de um sócio divergir da do outro."
        action={
          <Button type="button" variant="outline" onClick={adicionarSocio}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar sócio
          </Button>
        }
      >
        <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          Rateio do capital: <strong>{ROTULO_REGRA_CAPITAL[regra]}</strong> —{' '}
          {EXPLICACAO_REGRA_CAPITAL[regra]} Para trocar, vá à aba <em>Aportes</em>.
        </p>

        <div className="space-y-3">
          {socios.map((s, i) => {
            const rateio = resultado.rateioSocios[i];
            const aberto = abertos.has(i);
            const idPainel = `${idBase}-socio-${i}`;
            const aportes = aportesDe(s);
            const totalAportado = aportes.reduce((a, x) => a + (x.valor || 0), 0);
            const g = geradorDe(i);
            const divergente =
              rateio != null &&
              Math.abs(rateio.pctCapital - rateio.participacaoPct) > TOL_DIVERGENCIA;
            return (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white">
                <div className="grid grid-cols-1 items-end gap-3 p-4 md:grid-cols-[1.8fr_0.9fr_0.9fr_auto_1.2fr_auto]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Nome</label>
                    <Input value={s.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Participação (%)</label>
                    <Input
                      type="number"
                      step="any"
                      className="text-right tabular-nums"
                      value={s.participacaoPct * 100}
                      onChange={(e) => mudar(i, { participacaoPct: (Number(e.target.value) || 0) / 100 })}
                    />
                  </div>

                  {/* % do capital. Editável só na regra que o usa; nas demais o
                      número mostrado é o efetivo, para a coluna não mentir. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">% do capital</label>
                    <Input
                      type="number"
                      step="any"
                      disabled={!porCapital}
                      className={cn(
                        'text-right tabular-nums',
                        // Vazio mostra a participação em cinza: o default é
                        // HERDADO, e o usuário precisa ver de onde ele vem.
                        s.pctCapital == null && 'text-slate-400',
                      )}
                      value={
                        porCapital
                          ? s.pctCapital == null
                            ? Number((s.participacaoPct * 100).toFixed(6))
                            : Number((s.pctCapital * 100).toFixed(6))
                          : Number(((rateio?.pctCapital ?? s.participacaoPct) * 100).toFixed(6))
                      }
                      onChange={(e) =>
                        mudar(i, {
                          // Campo apagado volta a `null` — "usa a participação" —
                          // em vez de virar zero, que significaria "não põe capital".
                          pctCapital: e.target.value === '' ? null : (Number(e.target.value) || 0) / 100,
                        })
                      }
                    />
                    <p className="text-[11px] leading-4 text-slate-400">
                      {porCapital
                        ? s.pctCapital == null
                          ? 'Herdado da participação'
                          : 'Próprio'
                        : porCronograma
                          ? 'Derivado dos aportes'
                          : 'Igual à participação'}
                    </p>
                  </div>

                  <label className="mb-2 flex items-center gap-2 whitespace-nowrap text-xs text-slate-600">
                    <Switch checked={s.cotaDisponivel} onCheckedChange={(v) => mudar(i, { cotaDisponivel: v })} />
                    Cota disponível
                  </label>

                  {/* Capital EFETIVO: o número em dinheiro que este sócio aporta,
                      qualquer que seja a regra. É o que o sócio quer ver. */}
                  <div className="mb-1 text-right text-xs text-slate-500">
                    <div>
                      Capital efetivo:{' '}
                      <strong className={cn('tabular-nums', divergente ? 'text-amber-700' : 'text-slate-800')}>
                        {dinheiro(rateio?.capital, moeda)}
                      </strong>
                    </div>
                    <div className="tabular-nums">
                      Lucro: <strong className="text-slate-800">{dinheiro(rateio?.lucro, moeda)}</strong>
                    </div>
                    <div className="tabular-nums text-slate-400">
                      MOIC {multiplo(rateio?.moic)} · TIR {percentual(rateio?.tirAnual)}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-1 h-9 w-9 text-slate-400 hover:text-red-600"
                    onClick={() => alterar({ socios: socios.filter((_, k) => k !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Cronograma próprio — só na regra que o usa. */}
                {porCronograma ? (
                  <div className="border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => alternar(i)}
                      aria-expanded={aberto}
                      aria-controls={idPainel}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          'h-4 w-4 text-slate-400 transition-transform duration-200 motion-reduce:transition-none',
                          aberto && 'rotate-90',
                        )}
                      />
                      Aportes deste sócio
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-600">
                        {aportes.length} {aportes.length === 1 ? 'aporte' : 'aportes'} ·{' '}
                        {dinheiro(totalAportado, moeda)}
                      </span>
                    </button>

                    <div id={idPainel} hidden={!aberto} className="space-y-3 border-t border-slate-100 p-4">
                      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">Valor total</label>
                          <Input
                            type="number"
                            step="any"
                            className="text-right tabular-nums"
                            value={g.total}
                            onChange={(e) => mudarGerador(i, { total: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">Quantidade</label>
                          <Input
                            type="number"
                            min={1}
                            className="text-right tabular-nums"
                            value={g.quantidade}
                            onChange={(e) => mudarGerador(i, { quantidade: Number(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">Mês inicial</label>
                          <Input
                            type="number"
                            min={1}
                            className="text-right tabular-nums"
                            value={g.mesInicial}
                            onChange={(e) => mudarGerador(i, { mesInicial: Number(e.target.value) || 1 })}
                          />
                          <p className="text-[11px] leading-4 text-slate-500 tabular-nums">
                            mês {Math.max(1, g.mesInicial)} · {dataDoMes(g.mesInicial)}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-500">Periodicidade</label>
                          <Select value={g.passo} onValueChange={(v) => mudarGerador(i, { passo: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PERIODICIDADES.map((pp) => (
                                <SelectItem key={pp.valor} value={pp.valor}>
                                  {pp.rotulo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="button" variant="outline" onClick={() => gerar(i)}>
                          <Wand2 className="mr-2 h-4 w-4" />
                          Gerar
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className={`${cabecalho} text-left`}>#</th>
                              <th className={`${cabecalho} text-right`}>Mês</th>
                              <th className={`${cabecalho} text-right`}>Valor</th>
                              <th className={`${cabecalho} bg-slate-50 text-right`}>% do capital dele</th>
                              <th className={`${cabecalho} bg-slate-50 text-right`}>Acumulado</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {aportes.map((a, k) => {
                              const foraDoPrazo = a.mes > prazoTotal;
                              const acumulado = aportes
                                .slice(0, k + 1)
                                .reduce((acc, x) => acc + (x.valor || 0), 0);
                              return (
                                <tr key={a.id ?? `novo-${k}`} className="border-b border-slate-100 last:border-0">
                                  <td className="px-2 py-1.5 text-sm tabular-nums text-slate-500">{k + 1}</td>
                                  <td
                                    className="px-1 py-1.5"
                                    title={
                                      foraDoPrazo
                                        ? `Além do mês ${prazoTotal}, o fim do cronograma: o aporte fica guardado e inativo, e não entra no fluxo.`
                                        : undefined
                                    }
                                  >
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      className={cn(
                                        celula,
                                        foraDoPrazo && 'border-amber-400 bg-amber-50 text-amber-800',
                                      )}
                                      value={a.mes}
                                      onChange={(e) =>
                                        mudarAporte(i, a, { mes: Math.max(1, Number(e.target.value) || 1) })
                                      }
                                    />
                                    <p
                                      className={cn(
                                        'mt-0.5 pr-2 text-right text-[11px] tabular-nums',
                                        foraDoPrazo ? 'text-amber-700' : 'text-slate-400',
                                      )}
                                    >
                                      mês {a.mes} · {dataDoMes(a.mes)}
                                      {foraDoPrazo ? ' · guardado, inativo' : ''}
                                    </p>
                                  </td>
                                  <td className="px-1 py-1.5">
                                    <Input
                                      type="number"
                                      step="any"
                                      className={celula}
                                      value={a.valor}
                                      onChange={(e) => mudarAporte(i, a, { valor: Number(e.target.value) || 0 })}
                                    />
                                  </td>
                                  <td className={lido}>
                                    {percentual(totalAportado > 0 ? (a.valor || 0) / totalAportado : null)}
                                  </td>
                                  <td className={lido}>{dinheiro(acumulado, moeda)}</td>
                                  <td className="px-1 py-1.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Remover aporte"
                                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                                      onClick={() => gravarAportes(i, aportes.filter((x) => x !== a))}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                            {aportes.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-2 py-6 text-center text-sm text-slate-500">
                                  Nenhum aporte lançado. Sem aportes, o capital deste sócio fica zerado.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>

                      {/* É aqui que a divergência negociada fica visível: o que ele
                          põe do capital, lado a lado com o que ele tem da sociedade. */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
                        <div className="flex flex-wrap gap-4 tabular-nums">
                          <span className="text-slate-500">
                            Total aportado{' '}
                            <strong className="text-slate-900">{dinheiro(totalAportado, moeda)}</strong>
                          </span>
                          <span className={cn('text-slate-500', divergente && 'text-amber-700')}>
                            {percentual(rateio?.pctCapital)} do capital do projeto
                          </span>
                          <span className="text-slate-500">
                            contra {percentual(s.participacaoPct)} de participação
                          </span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => adicionarAporte(i)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar aporte
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div
            className={cn(
              'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold',
              somaOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            <span>Soma das participações</span>
            <span className="tabular-nums">{percentual(soma)}</span>
          </div>
          {!somaOk ? (
            <p className="text-xs text-red-600">
              As participações precisam somar 100% para salvar. O cálculo continua rodando — só o salvamento fica bloqueado.
            </p>
          ) : null}

          {porCapital ? (
            <div
              className={cn(
                'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold',
                capitalOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
              )}
            >
              <span>Soma dos percentuais de capital</span>
              <span className="tabular-nums">{percentual(somaCapital)}</span>
            </div>
          ) : null}
        </div>
      </FinanceDetailSectionCard>

      {/* Capital × Participação — as duas frações lado a lado. É a leitura que
          responde "por que a TIR dele é diferente da minha?" sem abrir o fluxo. */}
      {socios.length > 0 ? (
        <FinanceDetailSectionCard
          title="Capital × Participação"
          description="Quem põe mais capital do que tem de participação financia os outros: recebe o mesmo lucro sobre um capital maior, e por isso tem retorno menor. Divergência acima de 1 ponto percentual acende âmbar."
        >
          <div className="space-y-2">
            {resultado.rateioSocios.map((r, i) => {
              const dif = r.pctCapital - r.participacaoPct;
              const ambar = Math.abs(dif) > TOL_DIVERGENCIA;
              const maior = Math.max(0.0001, ...resultado.rateioSocios.flatMap((x) => [x.pctCapital, x.participacaoPct]));
              return (
                <div
                  key={i}
                  className={cn('rounded-lg px-3 py-2 text-xs', ambar && 'bg-amber-50')}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-700">{r.nome || `Sócio ${i + 1}`}</span>
                    <span className={cn('tabular-nums', ambar ? 'font-semibold text-amber-800' : 'text-slate-500')}>
                      {dif > 0 ? '+' : ''}
                      {percentual(dif)} de diferença
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-slate-500">Capital</span>
                    <span className="flex h-3 flex-1 items-center">
                      <span
                        className={cn('h-2.5 rounded-sm', ambar ? 'bg-amber-500' : 'bg-slate-800')}
                        style={{ width: `${(r.pctCapital / maior) * 100}%` }}
                        title={`Capital: ${percentual(r.pctCapital)}`}
                      />
                    </span>
                    <span className="w-28 shrink-0 text-right tabular-nums text-slate-700">
                      {percentual(r.pctCapital)} · {dinheiro(r.capital, moeda)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="w-20 shrink-0 text-slate-500">Participação</span>
                    <span className="flex h-3 flex-1 items-center">
                      <span
                        className="h-2.5 rounded-sm bg-slate-400"
                        style={{ width: `${(r.participacaoPct / maior) * 100}%` }}
                        title={`Participação: ${percentual(r.participacaoPct)}`}
                      />
                    </span>
                    <span className="w-28 shrink-0 text-right tabular-nums text-slate-700">
                      {percentual(r.participacaoPct)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </FinanceDetailSectionCard>
      ) : null}

      <FinanceDetailSectionCard
        title="Divisão do lucro"
        description="Como o lucro do projeto se reparte entre investidores e sponsor."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Investidores (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={rec.lucroInvestidoresPct * 100}
              onChange={(e) =>
                alterar({ receita: { ...rec, lucroInvestidoresPct: (Number(e.target.value) || 0) / 100 } })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Sponsor (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={rec.lucroSponsorPct * 100}
              onChange={(e) =>
                alterar({ receita: { ...rec, lucroSponsorPct: (Number(e.target.value) || 0) / 100 } })
              }
            />
          </div>
        </div>
        <div
          className={cn(
            'mt-4 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold',
            lucroOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
          )}
        >
          <span>Soma da divisão do lucro</span>
          <span className="tabular-nums">{percentual(somaLucro)}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          O lucro do sponsor não é distribuído no fluxo: fica como caixa residual do projeto. É por isso
          que a conferência “caixa final = lucro do sponsor” existe.
        </p>
      </FinanceDetailSectionCard>
    </div>
  );
}
