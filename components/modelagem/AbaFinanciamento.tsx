'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { Button } from '@/components/ui/button';
import type {
  ConvencaoJuros,
  Financiamento,
  ModelInput,
  ModelOutput,
  ModoSaque,
  PontoBenchmark,
} from '@/lib/modelagem';
import {
  CONVENCOES_JUROS,
  fatorJurosDoMes,
  prestacaoPrice,
  ROTULO_CONVENCAO_JUROS,
} from '@/lib/modelagem';
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

  const usaPrestacao = fin.modoAmortizacao === 'price' || fin.modoAmortizacao === 'sac';
  const curva = fin.benchmarkCurva ?? [];
  const prazoTotal = resultado.cronograma.prazoTotal;

  /** Ponto da curva por mês; ausente ≠ zero — sem ponto, vale o padrão. */
  const valorDoMes = (mes: number) => curva.find((p) => p.mes === mes)?.valor;

  const definirPontoCurva = (mes: number, valor: number | null) => {
    const outros = curva.filter((p) => p.mes !== mes);
    // `null` REMOVE o ponto (volta a valer o padrão); 0 declara benchmark zero.
    const nova: PontoBenchmark[] =
      valor == null ? outros : [...outros, { ...curva.find((p) => p.mes === mes), mes, valor }];
    mudar({ benchmarkCurva: nova.sort((a, b) => a.mes - b.mes) });
  };

  const preencherCurva = () =>
    mudar({
      benchmarkCurva: Array.from({ length: prazoTotal }, (_, k) => ({
        ...curva.find((p) => p.mes === k + 1),
        mes: k + 1,
        valor: valorDoMes(k + 1) ?? fin.benchmarkPadrao,
      })),
    });

  /**
   * Prévia da prestação, pela MESMA função pura do motor. É só uma prévia: o
   * motor recalcula a prestação a cada saque novo, sobre o principal daquele
   * momento, e aqui o principal é o total sacado do projeto inteiro.
   */
  const previaPrestacao = () => {
    const taxaAno = fin.tipoTaxa === 'variavel' ? fin.benchmarkPadrao + fin.spread : fin.taxaAnual;
    const i = fatorJurosDoMes(fin.convencaoJuros, taxaAno, resultado.cronograma.dataInicio);
    const n = Math.max(1, Math.trunc(fin.amortizacaoMeses ?? fin.prazoMeses ?? prazoTotal ?? 1));
    const principal = resultado.apuracao.dividaSacada;
    return fin.modoAmortizacao === 'sac' ? principal / n : prestacaoPrice(principal, i, n);
  };

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
                <SelectItem value="price">Price (prestação constante)</SelectItem>
                <SelectItem value="sac">SAC (principal constante)</SelectItem>
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

        {/* Carência, prestação e balloon: só aparecem nos modos que os usam. */}
        {usaPrestacao ? (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Prazo da dívida (meses)</Label>
              <Input
                type="number"
                min={1}
                className={financeDetailFieldClassName}
                placeholder="sem vencimento"
                value={fin.prazoMeses ?? ''}
                onChange={(e) => mudar({ prazoMeses: numeroOuNulo(e.target.value) })}
              />
              <p className="text-xs text-slate-500">
                {fin.prazoMeses
                  ? `Vence no mês ${fin.mesInicioSaque + fin.prazoMeses - 1}.`
                  : 'Sem prazo não há vencimento nem balloon.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Carência (meses)</Label>
              <Input
                type="number"
                min={0}
                className={financeDetailFieldClassName}
                value={fin.carenciaMeses}
                onChange={(e) => mudar({ carenciaMeses: Math.max(0, Number(e.target.value) || 0) })}
              />
              <p className="text-xs text-slate-500">Interest-only: só juros, sem amortizar.</p>
            </div>
            <div className="space-y-2">
              <Label>Amortização (meses)</Label>
              <Input
                type="number"
                min={1}
                className={financeDetailFieldClassName}
                placeholder={String(fin.prazoMeses ?? prazoTotal)}
                value={fin.amortizacaoMeses ?? ''}
                onChange={(e) => mudar({ amortizacaoMeses: numeroOuNulo(e.target.value) })}
              />
              <p className="text-xs text-slate-500">
                Maior que o prazo é o que gera o balloon — 20 de prazo e 300 de amortização é o
                caso clássico.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Prestação estimada</Label>
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold tabular-nums text-slate-900">
                {dinheiro(previaPrestacao(), rascunho.moeda)}
              </div>
              <p className="text-xs text-slate-500">
                Prévia sobre os {dinheiro(resultado.apuracao.dividaSacada, rascunho.moeda)} sacados. O
                motor recalcula a cada saque novo.
              </p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 md:col-span-4">
              <Switch
                checked={fin.balloonNoVencimento}
                onCheckedChange={(v) => mudar({ balloonNoVencimento: v })}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-800">Balloon no vencimento</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Todo o saldo remanescente é amortizado de uma vez no mês do vencimento. Desligado,
                  a dívida simplesmente para de amortizar e o saldo fica em aberto.
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Reserva de juros"
        description="Saldo que paga os juros até acabar. Depois disso a linha vira interest after reserve e o juro volta a sair do caixa."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Reserva de juros</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.reservaJuros}
              onChange={(e) => mudar({ reservaJuros: Number(e.target.value) || 0 })}
            />
            <p className="text-xs text-slate-500">
              Zero = sem reserva. Não substitui a capitalização de juros: os dois convivem, e a
              reserva paga primeiro.
            </p>
          </div>
          <label className="flex items-start gap-3 self-end rounded-xl border border-slate-200 p-3">
            <Switch
              checked={fin.reservaJurosSacada}
              onCheckedChange={(v) => mudar({ reservaJurosSacada: v })}
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Sacada do empréstimo</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Ligada, a reserva é constituída no primeiro saque, soma ao principal e paga juros
                sobre si mesma. Desligada, é bancada pelo equity e vale só como orçamento — não
                aumenta a dívida.
              </span>
            </span>
          </label>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Release price"
        description="Cada unidade vendida libera um valor para o banco. O saldo devedor cai em degraus a cada venda."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Release por unidade</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              value={fin.releasePrice}
              onChange={(e) => mudar({ releasePrice: Number(e.target.value) || 0 })}
            />
            <p className="text-xs text-slate-500">Zero = sem release por valor fixo.</p>
          </div>
          <div className="space-y-2">
            <Label>Ou % do preço de venda</Label>
            <Input
              type="number"
              step="any"
              className={financeDetailFieldClassName}
              placeholder="não usar"
              disabled={fin.releasePrice > 0}
              value={fin.releasePricePct == null ? '' : fin.releasePricePct * 100}
              onChange={(e) =>
                mudar({
                  releasePricePct:
                    e.target.value === '' ? null : (Number(e.target.value) || 0) / 100,
                })
              }
            />
            <p className="text-xs text-slate-500">
              Só é lido quando o valor fixo é zero — o fixo tem precedência.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Total liberado no projeto</Label>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold tabular-nums text-slate-900">
              {dinheiro(
                fin.releasePrice > 0
                  ? fin.releasePrice * resultado.agregados.unidadesTotal
                  : (fin.releasePricePct ?? 0) * resultado.agregados.vgv,
                rascunho.moeda,
              )}
            </div>
            <p className="text-xs text-slate-500">
              Contra {dinheiro(resultado.apuracao.dividaSacada, rascunho.moeda)} de dívida sacada.
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Convenção e indexação"
        description="Como o juro do mês é contado e se a taxa é fixa ou indexada."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Convenção de juros</Label>
            <Select
              value={fin.convencaoJuros}
              onValueChange={(v) => mudar({ convencaoJuros: v as ConvencaoJuros })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVENCOES_JUROS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {ROTULO_CONVENCAO_JUROS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              A convenção muda o juro TOTAL do projeto e deve vir do contrato, não do gosto de quem
              modela: sobre base 360, um ano de 365 dias cobra ~1,39% a mais que a conta mensal.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Tipo de taxa</Label>
            <Select
              value={fin.tipoTaxa}
              onValueChange={(v) => mudar({ tipoTaxa: v as Financiamento['tipoTaxa'] })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável (benchmark + spread)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {fin.tipoTaxa === 'fixa'
                ? 'A taxa ao ano acima vale para o projeto inteiro.'
                : 'A taxa ao ano acima deixa de ser lida.'}
            </p>
          </div>
          {fin.tipoTaxa === 'variavel' ? (
            <div className="space-y-2">
              <Label>Benchmark</Label>
              <Input
                className={financeDetailFieldClassName}
                placeholder="SOFR, CDI…"
                value={fin.benchmarkNome ?? ''}
                onChange={(e) => mudar({ benchmarkNome: e.target.value || null })}
              />
              <p className="text-xs text-slate-500">Só o nome, para a leitura do relatório.</p>
            </div>
          ) : null}
        </div>

        {fin.tipoTaxa === 'variavel' ? (
          <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Spread (%)</Label>
                <Input
                  type="number"
                  step="any"
                  className={financeDetailFieldClassName}
                  value={fin.spread * 100}
                  onChange={(e) => mudar({ spread: (Number(e.target.value) || 0) / 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Benchmark padrão (%)</Label>
                <Input
                  type="number"
                  step="any"
                  className={financeDetailFieldClassName}
                  value={fin.benchmarkPadrao * 100}
                  onChange={(e) => mudar({ benchmarkPadrao: (Number(e.target.value) || 0) / 100 })}
                />
                <p className="text-xs text-slate-500">
                  Vale nos meses sem ponto na curva. Mês sem linha não é benchmark zero.
                </p>
              </div>
              <div className="space-y-2 self-end">
                <Button type="button" variant="outline" onClick={preencherCurva}>
                  Preencher tudo com o padrão
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mês</th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Benchmark (%)</th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Taxa efetiva (a.a.)</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.meses.map((mes) => {
                    const v = valorDoMes(mes.mes);
                    return (
                      <tr key={mes.mes} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1 text-sm text-slate-600">
                          {mes.mes} <span className="text-slate-400">({mes.data})</span>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="any"
                            className="ml-auto h-8 w-28 text-right tabular-nums"
                            placeholder={`${(fin.benchmarkPadrao * 100).toFixed(4)} (padrão)`}
                            value={v == null ? '' : v * 100}
                            onChange={(e) =>
                              definirPontoCurva(
                                mes.mes,
                                e.target.value === '' ? null : (Number(e.target.value) || 0) / 100,
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1 text-right text-sm tabular-nums text-slate-700">
                          {percentual(mes.taxaEfetivaAno, 4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Campo em branco usa o padrão; digitar 0 declara benchmark zero naquele mês — são
              coisas diferentes, e o motor trata as duas assim.
            </p>
          </div>
        ) : null}
      </FinanceDetailSectionCard>
    </div>
  );
}
