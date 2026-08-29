'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ModelInput, ModelOutput, ModoVenda } from '@/lib/modelagem';
import { dinheiro, mesAno, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const EXPLICACAO_VENDA: Record<ModoVenda, string> = {
  single_exit: 'Todas as unidades vendidas de uma vez, no mês de saída.',
  per_unit: 'Cada unidade vende no seu próprio mês.',
  manual: 'Sem receita automática — só o que for lançado à mão no fluxo.',
};

export function AbaReceita({ rascunho, alterar, resultado }: Props) {
  const rec = rascunho.receita;
  const mudar = (patch: Partial<ModelInput['receita']>) => alterar({ receita: { ...rec, ...patch } });

  const vendas = rec.vendasPorUnidade ?? [];
  const mesDaUnidade = (i: number) => vendas.find((v) => v.unidadeIndex === i)?.mesVenda ?? '';

  const definirMes = (i: number, mes: number | null) => {
    const outras = vendas.filter((v) => v.unidadeIndex !== i);
    mudar({ vendasPorUnidade: mes == null ? outras : [...outras, { unidadeIndex: i, mesVenda: mes }] });
  };

  const fatorLiquido = 1 - rec.comissaoPct - rec.custoCartorioPct;

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Custos da venda"
        description="Descontados do VGV para chegar na receita líquida."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Comissão (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={rec.comissaoPct * 100}
              onChange={(e) => mudar({ comissaoPct: (Number(e.target.value) || 0) / 100 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cartório / closing (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={rec.custoCartorioPct * 100}
              onChange={(e) => mudar({ custoCartorioPct: (Number(e.target.value) || 0) / 100 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Receita líquida resultante</Label>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold tabular-nums text-slate-900">
              {dinheiro(resultado.apuracao.receitaLiquida, rascunho.moeda)}
            </div>
            <p className="text-xs text-slate-500">
              {percentual(fatorLiquido)} do VGV de {dinheiro(resultado.agregados.vgv, rascunho.moeda)}.
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Modo de venda" description="Quando a receita entra no fluxo.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={rec.modoVenda} onValueChange={(v) => mudar({ modoVenda: v as ModoVenda })}>
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_exit">Saída única</SelectItem>
                <SelectItem value="per_unit">Por unidade</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">{EXPLICACAO_VENDA[rec.modoVenda]}</p>
          </div>
          <div className="space-y-2">
            <Label>Mês de saída</Label>
            <Input
              type="number"
              min={1}
              className={financeDetailFieldClassName}
              placeholder={`padrão: prazo total (${resultado.cronograma.prazoTotal})`}
              value={rec.mesSaida ?? ''}
              onChange={(e) => mudar({ mesSaida: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500">
              É também o mês em que a dívida é quitada e o capital devolvido.
            </p>
          </div>
        </div>

        {rec.modoVenda === 'per_unit' ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Preço</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Mês de venda</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {rascunho.unidades.map((u, i) => {
                  const mes = mesDaUnidade(i);
                  const linha = typeof mes === 'number' ? resultado.meses[mes - 1] : undefined;
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-sm text-slate-800">{u.nome || `Unidade ${i + 1}`}</td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                        {dinheiro(u.precoVenda, rascunho.moeda)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          min={1}
                          className="ml-auto h-9 w-24 text-right tabular-nums"
                          value={mes}
                          onChange={(e) => definirMes(i, e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-slate-500">
                        {linha ? mesAno(linha.data) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </FinanceDetailSectionCard>
    </div>
  );
}
