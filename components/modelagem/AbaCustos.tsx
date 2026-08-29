'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { CustoAdicional, DistribuicaoCusto, ModelInput, ModelOutput } from '@/lib/modelagem';
import { dinheiro } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const EXPLICACAO: Record<DistribuicaoCusto, string> = {
  linear_construction: 'Dividido igualmente pelos meses de obra.',
  linear_total: 'Dividido igualmente pelo prazo total.',
  single_month: 'Lançado inteiro num único mês.',
  manual: 'Sem lançamento automático — só por override no fluxo.',
};

export function AbaCustos({ rascunho, alterar, resultado }: Props) {
  const custos = rascunho.custosAdicionais ?? [];

  const mudar = (i: number, patch: Partial<CustoAdicional>) =>
    alterar({ custosAdicionais: custos.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  return (
    <FinanceDetailSectionCard
      title="Custos adicionais"
      description="Custos que não pertencem a nenhuma unidade específica: contingência, taxas, seguros."
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            alterar({
              custosAdicionais: [
                ...custos,
                { label: '', valor: 0, distribuicao: 'linear_construction', mesAncora: null },
              ],
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar custo
        </Button>
      }
    >
      <div className="space-y-3">
        {custos.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_1.4fr_1fr_auto]"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Descrição</label>
              <Input value={c.label} onChange={(e) => mudar(i, { label: e.target.value })} placeholder="Contingência" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Valor</label>
              <Input
                type="number"
                step="any"
                className="text-right tabular-nums"
                value={c.valor}
                onChange={(e) => mudar(i, { valor: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Distribuição</label>
              <Select
                value={c.distribuicao}
                onValueChange={(v) => mudar(i, { distribuicao: v as DistribuicaoCusto })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear_construction">Linear na obra</SelectItem>
                  <SelectItem value="linear_total">Linear no prazo total</SelectItem>
                  <SelectItem value="single_month">Mês único</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-4 text-slate-500">{EXPLICACAO[c.distribuicao]}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Mês âncora</label>
              <Input
                type="number"
                min={1}
                className="text-right tabular-nums"
                disabled={c.distribuicao !== 'single_month'}
                value={c.mesAncora ?? ''}
                onChange={(e) => mudar(i, { mesAncora: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mb-1 h-9 w-9 text-slate-400 hover:text-red-600"
              onClick={() => alterar({ custosAdicionais: custos.filter((_, k) => k !== i) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {custos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum custo adicional. A modelagem roda normalmente sem eles.
          </p>
        ) : (
          <div className="flex justify-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
            Total lançado no fluxo: {dinheiro(resultado.apuracao.custoOutros, rascunho.moeda)}
          </div>
        )}
      </div>
    </FinanceDetailSectionCard>
  );
}
