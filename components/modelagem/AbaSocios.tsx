'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ModelInput, ModelOutput, Socio } from '@/lib/modelagem';
import { dinheiro, multiplo, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

export function AbaSocios({ rascunho, alterar, resultado }: Props) {
  const socios = rascunho.socios ?? [];
  const soma = socios.reduce((a, s) => a + (s.participacaoPct || 0), 0);
  const somaOk = Math.abs(soma - 1) <= 0.0001;

  const mudar = (i: number, patch: Partial<Socio>) =>
    alterar({ socios: socios.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const rec = rascunho.receita;
  const somaLucro = (rec.lucroInvestidoresPct || 0) + (rec.lucroSponsorPct || 0);
  const lucroOk = Math.abs(somaLucro - 1) <= 0.0001;

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Sócios"
        description="Todos os sócios são pro-rata. MOIC, ROI e TIR são idênticos para todos — o que varia é apenas a escala."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              alterar({ socios: [...socios, { nome: '', participacaoPct: 0, cotaDisponivel: false }] })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar sócio
          </Button>
        }
      >
        <div className="space-y-3">
          {socios.map((s, i) => {
            const rateio = resultado.rateioSocios[i];
            return (
              <div
                key={i}
                className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1fr_auto_1.4fr_auto]"
              >
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
                <label className="mb-2 flex items-center gap-2 whitespace-nowrap text-xs text-slate-600">
                  <Switch checked={s.cotaDisponivel} onCheckedChange={(v) => mudar(i, { cotaDisponivel: v })} />
                  Cota disponível
                </label>
                <div className="mb-1 text-right text-xs text-slate-500">
                  <div>
                    Capital: <strong className="text-slate-800">{dinheiro(rateio?.capital, rascunho.moeda)}</strong>
                  </div>
                  <div>
                    Lucro: <strong className="text-slate-800">{dinheiro(rateio?.lucro, rascunho.moeda)}</strong>
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

          {socios.length > 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              MOIC {multiplo(resultado.indicadores.moic)} · ROI {percentual(resultado.indicadores.roi)} · TIR anual{' '}
              {percentual(resultado.indicadores.tirAnual)} — <strong>idênticos para todos os sócios</strong>. A
              participação muda apenas a escala do capital e do lucro.
            </p>
          ) : null}
        </div>
      </FinanceDetailSectionCard>

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
