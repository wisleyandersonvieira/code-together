'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcular } from '@/lib/modelagem';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';
import { dinheiro, mesAno, multiplo, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  resultado: ModelOutput;
  aplicarDimensionamento: (novo: ModelInput['financiamento']) => void;
}

// Par categórico validado: ΔE 27,4 em protanopia, 35,3 em visão normal.
// O contraste do âmbar contra o fundo fica abaixo de 3:1, e o alívio exigido é a
// tabela completa logo abaixo do gráfico — que existe.
const COR_DIVIDA = '#0284c7';
const COR_EQUITY = '#f59e0b';

export function AbaDemandaCaixa({ rascunho, resultado, aplicarDimensionamento }: Props) {
  const [previa, setPrevia] = useState<ModelOutput | null>(null);
  const moeda = rascunho.moeda;
  // Com o plano ligado, o aporte do mês deixa de ser resíduo do caixa e passa a
  // ser a parcela. A comparação entre as duas curvas é o que justifica esta tela:
  // é aqui que se vê o plano não cobrindo a demanda, antes do caixa ficar negativo.
  const planoLigado = rascunho.aportes?.modoAporte === 'plano';
  const parcelaPorMes = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const p of rascunho.aportes?.parcelas ?? []) {
      mapa.set(p.mes, (mapa.get(p.mes) ?? 0) + (p.valor || 0));
    }
    return mapa;
  }, [rascunho.aportes?.parcelas]);
  const d = (v: number | null | undefined) => dinheiro(v, moeda);
  const colchao = rascunho.financiamento.colchaoMinimoCaixa;
  const teto = resultado.apuracao.tetoDivida;

  // Escala única para todas as barras: comparar meses só faz sentido num eixo só.
  const escala = useMemo(() => {
    const maximo = Math.max(
      1,
      ...resultado.meses.map((m) => Math.max(m.demandaBruta, m.draw + m.equityCall, m.saldoDevedor)),
    );
    return maximo;
  }, [resultado.meses]);

  const financiamentoDimensionado = (): ModelInput['financiamento'] => ({
    ...rascunho.financiamento,
    modoSaque: 'cash_demand',
  });

  const simular = () => {
    setPrevia(calcular({ ...rascunho, financiamento: financiamentoDimensionado() }));
  };

  const diff = previa
    ? [
        { rotulo: 'Dívida sacada', atual: resultado.apuracao.dividaSacada, novo: previa.apuracao.dividaSacada, fmt: d },
        { rotulo: 'Juros e taxas', atual: resultado.apuracao.custoFinanceiro, novo: previa.apuracao.custoFinanceiro, fmt: d },
        { rotulo: 'Equity total', atual: resultado.apuracao.equityTotal, novo: previa.apuracao.equityTotal, fmt: d },
        { rotulo: 'Lucro do projeto', atual: resultado.apuracao.lucroProjeto, novo: previa.apuracao.lucroProjeto, fmt: d },
        { rotulo: 'MOIC', atual: resultado.indicadores.moic, novo: previa.indicadores.moic, fmt: multiplo },
        { rotulo: 'TIR anual', atual: resultado.indicadores.tirAnual, novo: previa.indicadores.tirAnual, fmt: (v: any) => percentual(v) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-600">
          Modo de saque atual: <strong className="text-slate-900">{rascunho.financiamento.modoSaque}</strong> ·
          teto de dívida:{' '}
          <strong className="text-slate-900">{Number.isFinite(teto) ? d(teto) : 'sem teto'}</strong>
        </div>
        <Button type="button" variant="outline" onClick={simular}>
          <Wand2 className="mr-2 h-4 w-4" />
          Dimensionar financiamento pela demanda
        </Button>
      </div>

      {previa ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Prévia do modo <em>demanda de caixa</em>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Nada foi alterado ainda. Confira o comparativo e confirme para aplicar.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Indicador</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Atual</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensionado</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((l) => (
                  <tr key={l.rotulo} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-sm text-slate-700">{l.rotulo}</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-500">{l.fmt(l.atual as any)}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                      {l.fmt(l.novo as any)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                aplicarDimensionamento(financiamentoDimensionado());
                setPrevia(null);
              }}
            >
              Aplicar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPrevia(null)}>
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Demanda de caixa por mês</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_DIVIDA }} />
              Coberto por dívida
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_EQUITY }} />
              Coberto por equity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-slate-400" />
              Saldo devedor
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-end gap-1 overflow-x-auto pb-2">
          {resultado.meses.map((m) => {
            const alturaDivida = (m.draw / escala) * 160;
            const alturaEquity = (m.equityCall / escala) * 160;
            const alturaSaldo = (m.saldoDevedor / escala) * 160;
            const noTeto = Number.isFinite(teto) && m.capacidadeSaque <= 0.01 && m.draw > 0;
            const abaixoColchao = m.caixaAcumulado < colchao - 0.01;
            return (
              <div key={m.mes} className="relative flex min-w-[26px] flex-col items-center">
                <div className="relative flex h-[170px] w-full items-end justify-center">
                  {/* Saldo devedor como marca de referência, mesmo eixo e mesma unidade. */}
                  <div
                    className="absolute w-full border-t-2 border-slate-400"
                    style={{ bottom: `${alturaSaldo}px` }}
                    title={`Saldo devedor no mês ${m.mes}: ${d(m.saldoDevedor)}`}
                  />
                  <div
                    className="flex w-[16px] flex-col-reverse justify-start gap-[2px]"
                    title={`Mês ${m.mes} · demanda bruta ${d(m.demandaBruta)} · dívida ${d(m.draw)} · equity ${d(m.equityCall)}`}
                  >
                    <div
                      className="rounded-b-[2px] rounded-t-[4px]"
                      style={{ height: `${Math.max(alturaDivida, m.draw > 0 ? 2 : 0)}px`, background: COR_DIVIDA }}
                    />
                    <div
                      className="rounded-t-[4px]"
                      style={{ height: `${Math.max(alturaEquity, m.equityCall > 0 ? 2 : 0)}px`, background: COR_EQUITY }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    'mt-1 text-[10px] tabular-nums',
                    noTeto || abaixoColchao ? 'font-semibold text-red-600' : 'text-slate-400',
                  )}
                >
                  {m.mes}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Barras empilhadas: quanto de cada mês foi coberto por dívida e quanto por equity. A linha
          horizontal marca o saldo devedor — mesma unidade, mesmo eixo. Meses em vermelho bateram no
          teto de dívida ou ficaram abaixo do colchão.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-50">
            <tr>
              {[
                'Mês',
                'Demanda bruta',
                'Caixa de abertura',
                'Saque',
                ...(planoLigado ? ['Plano de aportes'] : []),
                'Aporte',
                'Caixa de fechamento',
                'Folga vs colchão',
                '',
              ].map((h, i) => (
                <th key={h + i} className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', i === 0 ? 'text-left' : 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultado.meses.map((m) => {
              const folga = m.caixaAcumulado - colchao;
              const noTeto = Number.isFinite(teto) && m.capacidadeSaque <= 0.01 && m.draw > 0;
              const abaixoColchao = folga < -0.01;
              return (
                <tr key={m.mes} className={cn('border-t border-slate-100', (noTeto || abaixoColchao) && 'bg-red-50/60')}>
                  <td className="px-3 py-2 text-sm text-slate-800">
                    {m.mes} <span className="text-slate-400">{mesAno(m.data)}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(m.demandaBruta)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-600">{d(m.caixaAbertura)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(m.draw)}</td>
                  {planoLigado ? (
                    <td
                      className={cn(
                        'px-3 py-2 text-right text-sm tabular-nums',
                        // O plano previu menos capital do que o mês pediu: é a
                        // origem do buraco de caixa que a coluna à direita mostra.
                        m.demandaBruta - m.draw > (parcelaPorMes.get(m.mes) ?? 0) + 0.01
                          ? 'font-semibold text-amber-700'
                          : 'text-slate-600',
                      )}
                    >
                      {d(parcelaPorMes.get(m.mes) ?? 0)}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{d(m.equityCall)}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-900">{d(m.caixaAcumulado)}</td>
                  <td className={cn('px-3 py-2 text-right text-sm tabular-nums', abaixoColchao ? 'font-semibold text-red-600' : 'text-slate-600')}>
                    {d(folga)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {noTeto ? (
                      <span title="A dívida bateu no teto neste mês">
                        <AlertTriangle className="ml-auto h-4 w-4 text-red-500" />
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
