'use client';

import { useMemo, useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LinhaFluxo, MesFluxo, ModelInput, ModelOutput } from '@/lib/modelagem';
import { dinheiroCurto, mesAno, paraNumero } from './formato';

interface Props {
  rascunho: ModelInput;
  resultado: ModelOutput;
  /** Mesma modelagem sem nenhum override — alimenta o tooltip do valor automático. */
  resultadoAutomatico: ModelOutput;
  aplicarOverride: (mes: number, linha: LinhaFluxo, valor: number | null) => void;
  reverterCelula: (mes: number, linha: LinhaFluxo) => void;
  reverterLinha: (linha: LinhaFluxo) => void;
  reverterTudo: () => void;
}

interface DefinicaoLinha {
  chave: string;
  rotulo: string;
  valor: (m: MesFluxo) => number;
  /** Linhas calculadas não recebem override: elas são consequência, não entrada. */
  linha?: LinhaFluxo;
  destaque?: boolean;
  separador?: boolean;
  somavel?: boolean;
}

/** Ordem fixa da grade. Cada linha editável carrega seu `line_key` estável. */
const LINHAS: DefinicaoLinha[] = [
  { chave: 'land', rotulo: 'Terrenos', valor: (m) => m.land, linha: 'land' },
  { chave: 'construction', rotulo: 'Obra', valor: (m) => m.construction, linha: 'construction' },
  { chave: 'property_tax', rotulo: 'Property taxes', valor: (m) => m.propertyTax, linha: 'property_tax' },
  { chave: 'other_costs', rotulo: 'Outros custos', valor: (m) => m.otherCosts, linha: 'other_costs' },
  { chave: 'custo_fin', rotulo: 'Juros e taxas', valor: (m) => m.custoFinanceiroCaixa },
  { chave: 'pagamentos', rotulo: 'Total de pagamentos', valor: (m) => m.pagamentos, destaque: true },
  { chave: 'revenue', rotulo: 'Receita', valor: (m) => m.revenue, linha: 'revenue', separador: true },
  { chave: 'draw', rotulo: 'Saque', valor: (m) => m.draw, linha: 'draw' },
  { chave: 'amortization', rotulo: 'Amortização', valor: (m) => m.amortization, linha: 'amortization' },
  { chave: 'equity_call', rotulo: 'Aporte de equity', valor: (m) => m.equityCall, linha: 'equity_call', destaque: true },
  { chave: 'distribution', rotulo: 'Distribuição', valor: (m) => m.distribution, linha: 'distribution' },
  { chave: 'saldo', rotulo: 'Saldo devedor', valor: (m) => m.saldoDevedor, separador: true, somavel: false },
  { chave: 'equity_ac', rotulo: 'Equity acumulado', valor: (m) => m.equityAcumulado, somavel: false },
  { chave: 'caixa_mes', rotulo: 'Caixa do mês', valor: (m) => m.caixaMes },
  { chave: 'caixa_ac', rotulo: 'Caixa acumulado', valor: (m) => m.caixaAcumulado, destaque: true, somavel: false },
];

const COL_ROTULO = 'sticky left-0 z-20 bg-white px-3 py-1.5 text-left text-sm';
const COL_TOTAL = 'sticky right-0 z-20 border-l border-slate-300 bg-slate-50 px-3 py-1.5 text-right text-sm tabular-nums';

export function AbaFluxoCaixa({
  rascunho,
  resultado,
  resultadoAutomatico,
  aplicarOverride,
  reverterCelula,
  reverterLinha,
  reverterTudo,
}: Props) {
  const [editando, setEditando] = useState<{ mes: number; linha: LinhaFluxo } | null>(null);
  const [rascunhoTexto, setRascunhoTexto] = useState('');

  const overridePorChave = useMemo(() => {
    const mapa = new Map<string, boolean>();
    for (const o of rascunho.overrides ?? []) mapa.set(`${o.mes}:${o.linha}`, true);
    return mapa;
  }, [rascunho.overrides]);

  const temOverride = (mes: number, linha?: LinhaFluxo) =>
    !!linha && overridePorChave.has(`${mes}:${linha}`);

  const meses = resultado.meses;
  const manuais = resultado.celulasManuais;
  /** Com o plano ligado, editar a linha de aporte grava parcela, não override. */
  const planoLigado = rascunho.aportes?.modoAporte === 'plano';

  const confirmar = (mes: number, linha: LinhaFluxo) => {
    const valor = paraNumero(rascunhoTexto);
    if (valor !== null) aplicarOverride(mes, linha, valor);
    setEditando(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {manuais > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800">
              <Pencil className="h-3.5 w-3.5" />
              {manuais} {manuais === 1 ? 'célula em modo manual' : 'células em modo manual'}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              Nenhuma célula em modo manual — tudo automático.
            </span>
          )}
          {resultado.overridesOrfaos.length > 0 ? (
            <span className="rounded-full bg-slate-200 px-3 py-1.5 text-xs text-slate-700">
              +{resultado.overridesOrfaos.length} fora do prazo (guardados, inativos)
            </span>
          ) : null}
        </div>
        {manuais > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={reverterTudo}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reverter modelagem inteira
          </Button>
        ) : null}
      </div>

      <div className="relative max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(COL_ROTULO, 'sticky top-0 z-30 border-b border-r border-slate-300 font-semibold text-slate-700')}>
                Linha
              </th>
              {meses.map((m) => (
                <th
                  key={m.mes}
                  className="sticky top-0 z-10 min-w-[92px] border-b border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-semibold text-slate-600"
                >
                  <div>{m.mes}</div>
                  <div className="font-normal text-slate-400">{mesAno(m.data)}</div>
                </th>
              ))}
              <th className={cn(COL_TOTAL, 'top-0 z-30 border-b border-slate-300 text-xs font-semibold text-slate-700')}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((def) => {
              const total = def.somavel === false ? null : meses.reduce((a, m) => a + def.valor(m), 0);
              const linhaTemManual = def.linha ? meses.some((m) => temOverride(m.mes, def.linha)) : false;
              return (
                <tr
                  key={def.chave}
                  className={cn(
                    def.separador && 'border-t-2 border-slate-300',
                    def.destaque ? 'bg-slate-100/70 font-semibold' : 'hover:bg-slate-50/60',
                  )}
                >
                  <td
                    className={cn(
                      COL_ROTULO,
                      'border-r border-slate-300 whitespace-nowrap',
                      def.destaque ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {def.rotulo}
                      {linhaTemManual ? (
                        <button
                          type="button"
                          title={`Reverter a linha "${def.rotulo}" para automático`}
                          onClick={() => def.linha && reverterLinha(def.linha)}
                          className="text-amber-600 hover:text-amber-800"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </span>
                  </td>

                  {meses.map((m) => {
                    const editavel = !!def.linha;
                    const marcado = temOverride(m.mes, def.linha);
                    const emEdicao =
                      editando && def.linha && editando.mes === m.mes && editando.linha === def.linha;
                    const automatico = def.valor(resultadoAutomatico.meses[m.mes - 1] ?? m);
                    const valor = def.valor(m);

                    if (emEdicao) {
                      return (
                        <td key={m.mes} className="border-b border-slate-100 p-0">
                          <input
                            autoFocus
                            className="h-8 w-full bg-amber-50 px-2 text-right text-sm tabular-nums outline-none ring-2 ring-amber-400"
                            value={rascunhoTexto}
                            onChange={(e) => setRascunhoTexto(e.target.value)}
                            onBlur={() => confirmar(m.mes, def.linha!)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmar(m.mes, def.linha!);
                              if (e.key === 'Escape') setEditando(null);
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={m.mes}
                        onClick={() => {
                          if (!editavel) return;
                          setRascunhoTexto(String(Number(valor.toFixed(2))));
                          setEditando({ mes: m.mes, linha: def.linha! });
                        }}
                        onDoubleClick={() => {
                          // Com o plano ligado a célula de aporte não tem override, mas
                          // tem parcela — e o duplo clique precisa dar conta dela também.
                          const reversivel = marcado || (planoLigado && def.linha === 'equity_call');
                          if (reversivel && def.linha) reverterCelula(m.mes, def.linha);
                        }}
                        title={
                          marcado
                            ? `Manual. Valor automático: ${dinheiroCurto(automatico)}. Duplo clique reverte.`
                            : !editavel
                              ? 'Linha calculada — não recebe override'
                              : planoLigado && def.linha === 'equity_call'
                                ? 'Editando aqui você altera a parcela do plano de aportes deste mês. Duplo clique remove a parcela.'
                                : 'Clique para lançar um valor manual'
                        }
                        className={cn(
                          'relative border-b border-slate-100 px-2 py-1.5 text-right tabular-nums',
                          editavel && 'cursor-cell',
                          marcado && 'bg-amber-50 font-medium text-amber-900',
                          !marcado && valor < 0 && 'text-red-600',
                          !editavel && 'text-slate-500',
                        )}
                      >
                        {marcado ? (
                          <Pencil className="absolute left-1 top-1.5 h-2.5 w-2.5 text-amber-500" />
                        ) : null}
                        {dinheiroCurto(valor)}
                      </td>
                    );
                  })}

                  <td className={cn(COL_TOTAL, def.destaque && 'bg-slate-200 font-semibold text-slate-900')}>
                    {total === null ? '—' : dinheiroCurto(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Clique numa célula editável para lançar um valor manual; duplo clique numa célula âmbar reverte
        para o automático. As linhas <em>Total de pagamentos</em>, <em>Saldo devedor</em>,{' '}
        <em>Equity acumulado</em> e <em>Caixa</em> são calculadas e não recebem override — elas são
        consequência das demais. Colunas “Saldo devedor”, “Equity acumulado” e “Caixa acumulado” não
        somam na coluna de total porque são saldos, não fluxos.
      </p>
    </div>
  );
}
