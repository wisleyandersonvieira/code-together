'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ConfigLocacao, ModelInput, ModelOutput, NoiReferencia } from '@/lib/modelagem';
import { EXPLICACAO_NOI_REFERENCIA, NOIS_REFERENCIA, ROTULO_NOI_REFERENCIA } from '@/lib/modelagem';
import { dinheiro, numero, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

/** Padrão neutro, igual ao do mapeador: nunca `undefined` para a tela editar. */
const NEUTRO: ConfigLocacao = {
  taxaReembolsoPct: 0,
  perdaCreditoPct: 0,
  capRateSaida: 0,
  custoVendaPct: 0,
  noiReferencia: 'estabilizado',
  ocupacaoEstabilizadaPct: 1,
};

/**
 * Aba "Locação e saída" — substitui a aba Receita no modo locação.
 *
 * Ela responde a uma pergunta só, e a resposta é o negócio inteiro: quanto vale o
 * ativo quando ficar pronto e locado. O bloco de leitura do fim mostra a CONTA
 * COMPLETA, e não só o resultado — é essa linha que faz o usuário confiar no
 * número em vez de conferir na planilha dele.
 */
export function AbaLocacaoSaida({ rascunho, alterar, resultado }: Props) {
  const loc = rascunho.locacao ?? NEUTRO;
  const mudar = (patch: Partial<ConfigLocacao>) => alterar({ locacao: { ...loc, ...patch } });

  const moeda = rascunho.moeda;
  const ind = resultado.indicadores;
  const ag = resultado.agregados;
  const unidades = rascunho.unidades ?? [];

  const mudarUnidade = (i: number, aluguelSfAno: number) =>
    alterar({ unidades: unidades.map((u, k) => (k === i ? { ...u, aluguelSfAno } : u)) });

  const qtd = (q: number) => Math.max(1, Math.trunc(q || 1));

  // Percentual entra como 7,5 e sai como 0,075. A conversão fica SÓ aqui: o
  // motor e o banco trabalham em fração, sem exceção.
  const pctCampo = (v: number) => (v * 100).toFixed(4).replace(/\.?0+$/, '');
  const lerPct = (t: string) => (Number(t.replace(',', '.')) || 0) / 100;

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Aluguel por tipologia"
        description="O aluguel é POR UNIDADE, por pé quadrado e por ano — a mesma convenção de área, terreno e obra. A receita a 100% de ocupação é a soma de área × aluguel × quantidade."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Tipologia</th>
                <th className="px-3 py-2 text-right">Área (sf/un)</th>
                <th className="px-3 py-2 text-right">Qtd.</th>
                <th className="px-3 py-2 text-right">ABL (sf)</th>
                <th className="px-3 py-2 text-right">Aluguel $/sf/ano</th>
                <th className="px-3 py-2 text-right">Receita anual a 100%</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u, i) => {
                const abl = (u.areaSf || 0) * qtd(u.quantidade);
                return (
                  <tr key={u.id ?? i} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-900">{u.nome || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numero(u.areaSf ?? 0, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtd(u.quantidade)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{numero(abl, 0)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="ml-auto h-8 w-28 text-right tabular-nums"
                        value={u.aluguelSfAno ?? 0}
                        onChange={(e) => mudarUnidade(i, Number(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {dinheiro(abl * (u.aluguelSfAno ?? 0), moeda)}
                    </td>
                  </tr>
                );
              })}
              {unidades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma tipologia cadastrada. Use a aba Ativo locável.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {unidades.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 font-semibold text-slate-900">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{ag.unidadesTotal}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{numero(ag.ablSf, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {/* Média PONDERADA PELA ÁREA, não média simples: é a mesma
                        conta de `Indicadores.aluguelPorSf`. */}
                    {ind.aluguelPorSf === null ? 'n/d' : dinheiro(ind.aluguelPorSf, moeda)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dinheiro(ag.receitaBrutaAnual100, moeda)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Saída"
        description="O ativo estabilizado é vendido a um fundo pelo cap rate. O valor é o NOI de referência dividido pelo cap, menos o custo de venda."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Cap rate de saída (%)</Label>
            <Input
              className={financeDetailFieldClassName}
              type="number"
              step="0.01"
              min={0}
              value={pctCampo(loc.capRateSaida)}
              onChange={(e) => mudar({ capRateSaida: lerPct(e.target.value) })}
            />
            <p className="text-xs leading-5 text-slate-500">
              A taxa que o comprador exige. Zerado, o valor de saída é ZERO — o motor não divide
              por zero.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Custo de venda (%)</Label>
            <Input
              className={financeDetailFieldClassName}
              type="number"
              step="0.01"
              min={0}
              value={pctCampo(loc.custoVendaPct)}
              onChange={(e) => mudar({ custoVendaPct: lerPct(e.target.value) })}
            />
            <p className="text-xs leading-5 text-slate-500">
              A corretagem da venda do ativo. Comissão e cartório NÃO se aplicam aqui — este campo
              faz o papel dos dois, e aplicar os três contaria a corretagem duas vezes.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>NOI de referência</Label>
            <Select
              value={loc.noiReferencia}
              onValueChange={(v) => mudar({ noiReferencia: v as NoiReferencia })}
            >
              <SelectTrigger className={financeDetailFieldClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOIS_REFERENCIA.map((n) => (
                  <SelectItem key={n} value={n}>
                    {ROTULO_NOI_REFERENCIA[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              {EXPLICACAO_NOI_REFERENCIA[loc.noiReferencia]}
            </p>
            <p className="text-xs leading-5 text-slate-400">
              O padrão de mercado é o NOI forward 12 meses a partir da saída. Ele exigiria modelar
              12 meses além do horizonte do projeto, com premissas de reajuste e renovação que a
              modelagem não tem — as duas opções acima ficam dentro do prazo e são auditáveis linha
              a linha.
            </p>
          </div>
        </div>

        {/* ─── A CONTA INTEIRA ──────────────────────────────────────────────
            É esta linha que faz o usuário confiar no número. Mostrar só o valor
            de saída obrigaria a refazer a conta na planilha para acreditar — e
            quem refaz a conta acaba usando a planilha. */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Como o valor de saída é calculado
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg tabular-nums text-slate-900">
            <span title="NOI de referência, ao ano">{dinheiro(ind.noiEstabilizado ?? 0, moeda)}</span>
            <span className="text-slate-400">÷</span>
            <span title="Cap rate de saída">{percentual(loc.capRateSaida)}</span>
            <span className="text-slate-400">=</span>
            <span className="font-semibold">{dinheiro(ind.valorSaida ?? 0, moeda)}</span>
            <span className="text-slate-400">−</span>
            <span title="Custo de venda">{percentual(loc.custoVendaPct)}</span>
            <span className="text-slate-400">=</span>
            <strong className="text-emerald-700">
              {dinheiro((ind.valorSaida ?? 0) * (1 - loc.custoVendaPct), moeda)}
            </strong>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            O último número é o que entra na linha <em>Receita</em> do fluxo, num lançamento único
            no mês {resultado.cronograma.mesSaida}. Nenhuma unidade é vendida: o que vende é o
            ativo.
          </p>

          {/* A decomposição do NOI, para o número de cima não ser mágico. */}
          <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
            {[
              ['Receita anual a 100% de ocupação', dinheiro(ag.receitaBrutaAnual100, moeda)],
              ['× ocupação estabilizada', percentual(loc.ocupacaoEstabilizadaPct)],
              ['× (1 − perda de crédito)', percentual(1 - loc.perdaCreditoPct)],
              [
                '− OPEX líquido de reembolso',
                dinheiro(
                  ag.receitaBrutaAnual100 *
                    loc.ocupacaoEstabilizadaPct *
                    (1 - loc.perdaCreditoPct) -
                    (ind.noiEstabilizado ?? 0),
                  moeda,
                ),
              ],
              ['= NOI de referência (ao ano)', dinheiro(ind.noiEstabilizado ?? 0, moeda)],
              ['Yield on cost', percentual(ind.yieldOnCost)],
            ].map(([r, v]) => (
              <div key={r} className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-600">{r}</dt>
                <dd className="tabular-nums font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Divisão do lucro"
        description="Igual ao modo venda: a camada de investidores e a do sponsor somam 100% do lucro do projeto."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['Investidores (%)', 'lucroInvestidoresPct'],
              ['Sponsor (%)', 'lucroSponsorPct'],
            ] as const
          ).map(([rotulo, campo]) => (
            <div key={campo} className="space-y-2">
              <Label>{rotulo}</Label>
              <Input
                className={financeDetailFieldClassName}
                type="number"
                step="0.01"
                min={0}
                value={pctCampo(rascunho.receita[campo])}
                onChange={(e) =>
                  alterar({ receita: { ...rascunho.receita, [campo]: lerPct(e.target.value) } })
                }
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label>Mês de saída</Label>
            <Input
              className={financeDetailFieldClassName}
              type="number"
              min={1}
              value={rascunho.receita.mesSaida ?? resultado.cronograma.prazoTotal}
              onChange={(e) =>
                alterar({
                  receita: { ...rascunho.receita, mesSaida: Number(e.target.value) || null },
                })
              }
            />
            <p className="text-xs leading-5 text-slate-500">
              O mês em que o ativo é vendido. A curva de ocupação além dele não gera receita — o
              dono a partir dali é o comprador.
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>
    </div>
  );
}
