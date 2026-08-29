'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ModelInput, ModelOutput, Unidade } from '@/lib/modelagem';
import { dinheiro, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const celula = 'h-9 rounded-lg border-slate-200 bg-white px-2 text-right text-sm tabular-nums';
const cabecalho = 'px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500';

const UNIDADE_NOVA: Unidade = {
  nome: '',
  cidade: '',
  areaSf: 0,
  custoTerreno: 0,
  custoObra: 0,
  aporteBase: 0,
  precoVenda: 0,
  propertyTaxAno: 0,
};

export function AbaUnidades({ rascunho, alterar, resultado }: Props) {
  const unidades = rascunho.unidades;

  const mudar = (i: number, patch: Partial<Unidade>) =>
    alterar({ unidades: unidades.map((u, k) => (k === i ? { ...u, ...patch } : u)) });

  const remover = (i: number) => alterar({ unidades: unidades.filter((_, k) => k !== i) });

  const total = (f: (u: Unidade) => number) => unidades.reduce((a, u) => a + (f(u) || 0), 0);

  return (
    <FinanceDetailSectionCard
      title="Unidades"
      description="Aporte base é premissa de dimensionamento da curva de financiamento — não é o aporte real. O aporte efetivo é calculado no fluxo de caixa e costuma ser bem diferente."
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() => alterar({ unidades: [...unidades, { ...UNIDADE_NOVA }] })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar unidade
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={`${cabecalho} text-left`}>Nome</th>
              <th className={`${cabecalho} text-left`}>Cidade</th>
              <th className={`${cabecalho} text-right`}>Área sf</th>
              <th className={`${cabecalho} text-right`}>Terreno</th>
              <th className={`${cabecalho} text-right`}>Obra</th>
              <th className={`${cabecalho} text-right`}>Aporte base</th>
              <th className={`${cabecalho} text-right`}>Preço de venda</th>
              <th className={`${cabecalho} text-right`}>Tax/ano</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Custo total</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Financ. implícito</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Margem</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {unidades.map((u, i) => {
              const res = resultado.resultadoUnidades[i];
              const custoDireto = (u.custoTerreno || 0) + (u.custoObra || 0);
              // Quanto da unidade não é coberto pelo aporte base — é a parcela
              // que a dívida precisa financiar na regra equity_first.
              const financImplicito = Math.max(0, custoDireto - (u.aporteBase || 0));
              return (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-1 py-1.5">
                    <Input
                      className={`${celula} text-left`}
                      value={u.nome}
                      onChange={(e) => mudar(i, { nome: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      className={`${celula} text-left`}
                      value={u.cidade ?? ''}
                      onChange={(e) => mudar(i, { cidade: e.target.value })}
                    />
                  </td>
                  {([
                    ['areaSf', u.areaSf],
                    ['custoTerreno', u.custoTerreno],
                    ['custoObra', u.custoObra],
                    ['aporteBase', u.aporteBase],
                    ['precoVenda', u.precoVenda],
                    ['propertyTaxAno', u.propertyTaxAno],
                  ] as const).map(([campo, valor]) => (
                    <td key={campo} className="px-1 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        className={celula}
                        value={valor ?? 0}
                        onChange={(e) => mudar(i, { [campo]: Number(e.target.value) || 0 } as Partial<Unidade>)}
                      />
                    </td>
                  ))}
                  <td className="bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700">
                    {dinheiro(res?.custoTotal ?? custoDireto, rascunho.moeda)}
                  </td>
                  <td className="bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700">
                    {dinheiro(financImplicito, rascunho.moeda)}
                  </td>
                  <td className="bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700">
                    {percentual(res?.margem)}
                  </td>
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      onClick={() => remover(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {unidades.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-2 py-8 text-center text-sm text-slate-500">
                  Nenhuma unidade cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
          {unidades.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <td className="px-2 py-2 text-sm" colSpan={2}>
                  Totais ({unidades.length} unidades)
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {total((u) => u.areaSf ?? 0).toLocaleString('en-US')}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.terrenosTotal, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.obraTotal, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.aporteBase, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.vgv, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.taxAnoTotal, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums" colSpan={4} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-800">
        <strong>Aporte base ≠ aporte real.</strong> A soma dos aportes base é{' '}
        {dinheiro(resultado.agregados.aporteBase, rascunho.moeda)}, mas o capital efetivamente
        chamado no fluxo é {dinheiro(resultado.apuracao.equityTotal, rascunho.moeda)}. O aporte base
        só dimensiona a curva do modo <em>equity_first</em>.
      </p>
    </FinanceDetailSectionCard>
  );
}
