'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { Financiamento, ModelInput, ModelOutput, ModoSaque } from '@/lib/modelagem';
import { dinheiro, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const EXPLICACAO_SAQUE: Record<ModoSaque, string> = {
  equity_first: 'O capital próprio entra primeiro na obra; a dívida só começa quando a obra acumulada passa do aporte base disponível.',
  cash_demand: 'A dívida é dimensionada pela necessidade real de caixa de cada mês, respeitando o teto.',
  manual: 'Nenhum saque automático — só o que for lançado à mão no fluxo.',
};

export function AbaFinanciamento({ rascunho, alterar, resultado }: Props) {
  const fin = rascunho.financiamento;
  const mudar = (patch: Partial<Financiamento>) =>
    alterar({ financiamento: { ...fin, ...patch } });

  const numeroOuNulo = (v: string) => (v === '' ? null : Number(v));

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard title="Custo da dívida" description="Taxa nominal e fee de estruturação.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Taxa ao ano (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.taxaAnual * 100}
              onChange={(e) => mudar({ taxaAnual: (Number(e.target.value) || 0) / 100 })}
            />
            <p className="text-xs text-slate-500">Equivale a {percentual(fin.taxaAnual / 12, 4)} ao mês.</p>
          </div>
          <div className="space-y-2">
            <Label>Fee de estruturação (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.feeEstruturacaoPct * 100}
              onChange={(e) => mudar({ feeEstruturacaoPct: (Number(e.target.value) || 0) / 100 })}
            />
            <p className="text-xs text-slate-500">
              Incide sobre o total sacado: {dinheiro(resultado.apuracao.feeTotal, rascunho.moeda)}.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Quando o fee é cobrado</Label>
            <Select value={fin.feeTiming} onValueChange={(v) => mudar({ feeTiming: v as Financiamento['feeTiming'] })}>
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_draw">No primeiro saque</SelectItem>
                <SelectItem value="contract_month">Em mês específico</SelectItem>
              </SelectContent>
            </Select>
            {fin.feeTiming === 'contract_month' ? (
              <Input
                type="number"
                min={1}
                className={financeDetailFieldClassName}
                placeholder="Mês do fee"
                value={fin.feeMes ?? ''}
                onChange={(e) => mudar({ feeMes: numeroOuNulo(e.target.value) })}
              />
            ) : null}
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Curva de saque" description="Janela, modo de dimensionamento e teto.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Primeiro mês de saque</Label>
            <Input
              type="number"
              min={1}
              className={financeDetailFieldClassName}
              value={fin.mesInicioSaque}
              onChange={(e) => mudar({ mesInicioSaque: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Último mês de saque</Label>
            <Input
              type="number"
              min={1}
              className={financeDetailFieldClassName}
              value={fin.mesFimSaque}
              onChange={(e) => mudar({ mesFimSaque: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Modo de saque</Label>
            <Select value={fin.modoSaque} onValueChange={(v) => mudar({ modoSaque: v as ModoSaque })}>
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equity_first">Equity primeiro</SelectItem>
                <SelectItem value="cash_demand">Demanda de caixa</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          {EXPLICACAO_SAQUE[fin.modoSaque]}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>LTC máximo (%)</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              placeholder="sem teto"
              value={fin.maxLtcPct == null ? '' : fin.maxLtcPct * 100}
              onChange={(e) =>
                mudar({ maxLtcPct: e.target.value === '' ? null : (Number(e.target.value) || 0) / 100 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Valor contratado</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              placeholder="usa o LTC"
              value={fin.valorContratado ?? ''}
              onChange={(e) => mudar({ valorContratado: numeroOuNulo(e.target.value) })}
            />
            <p className="text-xs text-slate-500">Tem precedência sobre o LTC quando preenchido.</p>
          </div>
          <div className="space-y-2">
            <Label>Colchão mínimo de caixa</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.colchaoMinimoCaixa}
              onChange={(e) => mudar({ colchaoMinimoCaixa: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard title="Amortização e juros" description="Como a dívida é quitada e como os juros são tratados.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Modo de amortização</Label>
            <Select
              value={fin.modoAmortizacao}
              onValueChange={(v) => mudar({ modoAmortizacao: v as Financiamento['modoAmortizacao'] })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="at_exit">Quitação na saída</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4 pt-1">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <Switch checked={fin.capitalizarJuros} onCheckedChange={(v) => mudar({ capitalizarJuros: v })} />
              <span className="text-sm">
                <span className="font-medium text-slate-800">Capitalizar juros</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Os juros viram principal em vez de sair do caixa. Exige iteração no cálculo.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <Switch
                checked={fin.custoFinanceiroNaDemanda}
                onCheckedChange={(v) => mudar({ custoFinanceiroNaDemanda: v })}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-800">Financiar o custo financeiro</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  No modo demanda de caixa, faz a dívida cobrir também juros e fee. Sem isso, eles ficam por conta do equity.
                </span>
              </span>
            </label>
          </div>
        </div>
      </FinanceDetailSectionCard>
    </div>
  );
}
