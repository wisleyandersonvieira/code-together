'use client';

import { useMemo } from 'react';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { cn } from '@/lib/utils';
import {
  gradeSensibilidade,
  pontosDeEquilibrio,
  sensibilidadePrazo,
  VARIACOES_CUSTO,
  VARIACOES_PRECO,
} from '@/lib/modelagem';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';
import { dinheiro, multiplo, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  resultado: ModelOutput;
}

/**
 * Escala divergente ancorada no zero: prejuízo de um lado, lucro do outro, e um
 * cinza neutro exatamente no ponto de equilíbrio. Duas matizes e um meio neutro —
 * nunca arco-íris, e nunca uma matiz no meio.
 */
function corDivergente(valor: number, maximoAbsoluto: number): string {
  if (maximoAbsoluto <= 0) return '#f1f5f9';
  const t = Math.max(-1, Math.min(1, valor / maximoAbsoluto));
  if (Math.abs(t) < 0.02) return '#f1f5f9'; // slate-100 no meio
  if (t > 0) {
    const passos = ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399'];
    return passos[Math.min(passos.length - 1, Math.floor(t * passos.length))];
  }
  const passos = ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171'];
  return passos[Math.min(passos.length - 1, Math.floor(-t * passos.length))];
}

export function AbaSensibilidade({ rascunho, resultado }: Props) {
  const moeda = rascunho.moeda;
  const d = (v: number | null | undefined) => dinheiro(v, moeda);

  // Cada célula é uma rodada completa do motor: 30 rodadas. Memo evita refazer a
  // cada render de aba.
  const grade = useMemo(() => gradeSensibilidade(rascunho), [rascunho]);
  const equilibrio = useMemo(() => pontosDeEquilibrio(rascunho), [rascunho]);
  const atrasos = useMemo(() => sensibilidadePrazo(rascunho, [0, 3, 6, 12]), [rascunho]);

  const maximoAbs = Math.max(...grade.flat().map((c) => Math.abs(c.lucroProjeto)), 1);

  const Grade = ({
    titulo,
    descricao,
    valor,
    formatar,
    colorir,
  }: {
    titulo: string;
    descricao: string;
    valor: (c: (typeof grade)[0][0]) => number | null;
    formatar: (v: number | null) => string;
    colorir: boolean;
  }) => (
    <div>
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      <p className="mb-3 text-xs text-slate-500">{descricao}</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preço \ Obra
              </th>
              {VARIACOES_CUSTO.map((vc) => (
                <th key={vc} className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                  {vc > 0 ? '+' : ''}
                  {(vc * 100).toFixed(0)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.map((linha, i) => (
              <tr key={i} className="border-t border-slate-100">
                <th className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                  {VARIACOES_PRECO[i] > 0 ? '+' : ''}
                  {(VARIACOES_PRECO[i] * 100).toFixed(0)}%
                </th>
                {linha.map((celula, k) => {
                  const v = valor(celula);
                  const central = VARIACOES_PRECO[i] === 0 && VARIACOES_CUSTO[k] === 0;
                  return (
                    <td
                      key={k}
                      title={`Preço ${(celula.variacaoPreco * 100).toFixed(0)}% · obra ${(celula.variacaoCusto * 100).toFixed(0)}% → lucro ${d(celula.lucroProjeto)}, MOIC ${multiplo(celula.moic)}`}
                      className={cn(
                        'px-3 py-2 text-right text-sm tabular-nums text-slate-900',
                        central && 'font-semibold ring-2 ring-inset ring-slate-900',
                      )}
                      style={colorir ? { background: corDivergente(celula.lucroProjeto, maximoAbs) } : undefined}
                    >
                      {formatar(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Sensibilidade a preço e custo de obra"
        description="Cada célula é uma rodada completa do motor, não uma interpolação — o lucro não é linear no custo de obra, porque mexer na obra mexe na curva de saque e nos juros. A célula com contorno é o caso base."
      >
        <div className="space-y-8">
          <Grade
            titulo="Lucro do projeto"
            descricao="Escala divergente ancorada no zero: vermelho é prejuízo, verde é lucro, cinza é o ponto de equilíbrio."
            valor={(c) => c.lucroProjeto}
            formatar={(v) => d(v)}
            colorir
          />
          <Grade
            titulo="MOIC"
            descricao="Mesma grade, medindo o múltiplo sobre o capital investido."
            valor={(c) => c.moic}
            formatar={(v) => multiplo(v)}
            colorir={false}
          />
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Pontos de equilíbrio"
        description="Onde o lucro do projeto zera. Calculados por bisseção sobre o próprio motor."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { rotulo: 'VGV mínimo', valor: equilibrio.vgvMinimo === null ? 'n/d' : d(equilibrio.vgvMinimo), nota: `Atual: ${d(resultado.agregados.vgv)}` },
            { rotulo: 'Queda máxima no preço', valor: percentual(equilibrio.quedaMaximaPreco), nota: 'Antes de o lucro virar prejuízo' },
            { rotulo: 'Custo de obra máximo', valor: equilibrio.custoObraMaximo === null ? 'n/d' : d(equilibrio.custoObraMaximo), nota: `Atual: ${d(resultado.agregados.obraTotal)}` },
            { rotulo: 'Alta máxima na obra', valor: percentual(equilibrio.altaMaximaCusto), nota: 'Antes de o lucro virar prejuízo' },
          ].map((c) => (
            <div key={c.rotulo} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.rotulo}</p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900">{c.valor}</p>
              <p className="mt-1 text-xs text-slate-500">{c.nota}</p>
            </div>
          ))}
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Sensibilidade ao prazo"
        description="Atrasar a venda estende o property tax e, principalmente, a curva de juros — a dívida só é quitada na saída."
      >
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[560px]">
            <thead className="bg-slate-50">
              <tr>
                {['Atraso', 'Prazo total', 'Lucro do projeto', 'MOIC', 'TIR anual'].map((h, i) => (
                  <th key={h} className={cn('px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', i === 0 ? 'text-left' : 'text-right')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {atrasos.map((a) => (
                <tr key={a.mesesAtraso} className={cn('border-t border-slate-100', a.mesesAtraso === 0 && 'bg-slate-50 font-medium')}>
                  <td className="px-4 py-2 text-sm text-slate-800">
                    {a.mesesAtraso === 0 ? 'Sem atraso (base)' : `+${a.mesesAtraso} meses`}
                  </td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">{a.prazoTotal}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-900">{d(a.lucroProjeto)}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">{multiplo(a.moic)}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">{percentual(a.tirAnual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinanceDetailSectionCard>
    </div>
  );
}
