'use client';

import { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ConfigLocacao, LinhaOpex, ModelInput, ModelOutput, PontoOcupacao } from '@/lib/modelagem';
import { dinheiro, mesAno, numero, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const NEUTRO: ConfigLocacao = {
  taxaReembolsoPct: 0,
  perdaCreditoPct: 0,
  capRateSaida: 0,
  custoVendaPct: 0,
  noiReferencia: 'estabilizado',
  ocupacaoEstabilizadaPct: 1,
  // Nulo é o estado NORMAL, não um campo por preencher: significa "derivado do
  // cronograma" (mês de fim da obra + 1).
  mesInicioOpex: null,
};

/** Faixas da tabela de NOI: de 10 em 10%, mais o zero. */
const FAIXAS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/**
 * Aba "Operação" — o OPEX e a curva de ocupação.
 *
 * As duas coisas juntas porque são as duas metades da mesma conta: o OPEX bruto
 * corre igual todo mês, o reembolso acompanha a ocupação, e é dessa assimetria
 * que sai o comportamento central do modelo — o NOI é NEGATIVO em ocupação baixa.
 * A tabela do fim mostra exatamente isso, e é a leitura mais útil da pro forma.
 */
export function AbaOperacao({ rascunho, alterar, resultado }: Props) {
  const loc = rascunho.locacao ?? NEUTRO;
  const mudarLoc = (patch: Partial<ConfigLocacao>) => alterar({ locacao: { ...loc, ...patch } });

  const moeda = rascunho.moeda;
  const ag = resultado.agregados;
  const abl = ag.ablSf;
  const linhas = rascunho.opex ?? [];
  const curva = rascunho.ocupacao ?? [];
  const prazo = resultado.cronograma.prazoTotal;

  // ─── A janela de operação (migration 1764500000) ───────────────────────────
  // Os três números vêm PRONTOS do motor: a tela não recalcula a janela, pelo
  // mesmo motivo de as conferências não recalcularem — cobrar um número que o
  // fluxo não usou é justamente como um painel passa a mentir.
  const cron = resultado.cronograma;
  const inicioOperacao = cron.mesInicioOperacao;
  const fimOperacao = cron.mesFimOperacao;
  const janelaVazia = inicioOperacao > fimOperacao;
  const duracaoJanela = janelaVazia ? 0 : fimOperacao - inicioOperacao + 1;
  /** O que o campo vazio significa: fim da obra + 1. É o placeholder. */
  const inicioDerivado = cron.mesFimObra + 1;
  const foraDaJanela = (m: number) => m < inicioOperacao || m > fimOperacao;

  const pctCampo = (v: number) => (v * 100).toFixed(4).replace(/\.?0+$/, '');
  const lerPct = (t: string) => (Number(t.replace(',', '.')) || 0) / 100;

  // ─── OPEX ──────────────────────────────────────────────────────────────────
  const mudarLinha = (i: number, patch: Partial<LinhaOpex>) =>
    alterar({ opex: linhas.map((l, k) => (k === i ? { ...l, ...patch } : l)) });

  const acrescentarLinha = () =>
    alterar({
      opex: [...linhas, { ordem: linhas.length, label: 'Nova despesa', valorSfAno: 0, reembolsavel: true }],
    });

  const removerLinha = (i: number) => alterar({ opex: linhas.filter((_, k) => k !== i) });

  const anualDaLinha = (l: LinhaOpex) => (l.valorSfAno || 0) * abl;
  const opexBrutoAnual = linhas.reduce((a, l) => a + anualDaLinha(l), 0);
  const opexReembolsavelAnual = linhas
    .filter((l) => l.reembolsavel !== false)
    .reduce((a, l) => a + anualDaLinha(l), 0);
  const receitaAnual = ag.receitaBrutaAnual100;

  // ─── Curva de ocupação ─────────────────────────────────────────────────────
  const ocupacaoDoMes = (m: number) => curva.find((p) => p.mes === m)?.ocupacaoPct ?? null;

  const definirMes = (m: number, valor: number | null) => {
    const outros = curva.filter((p) => p.mes !== m);
    // Mês sem ponto é ocupação ZERO, e um zero declarado dá o mesmo número. A
    // distinção que sobrevive é de LEITURA: apagar diz "ainda não preenchi".
    alterar({
      ocupacao:
        valor == null
          ? outros
          : [...outros, { mes: m, ocupacaoPct: Math.min(1, Math.max(0, valor)) }].sort(
              (a, b) => a.mes - b.mes,
            ),
    });
  };

  // NULO = "segue o mês de início da operação". Antes o gerador nascia em
  // `mesFimObra + 1` e ficava congelado ali: quem mudasse a janela tinha de
  // acertar os dois na mão, e desencontrar os dois é fácil demais.
  const [inicioLeaseUp, setInicioLeaseUp] = useState<number | null>(null);
  const inicioLeaseUpEfetivo = inicioLeaseUp ?? inicioOperacao;
  const [mesesAteEstabilizar, setMesesAteEstabilizar] = useState(12);

  /**
   * Rampa LINEAR do lease-up: de zero até a ocupação estabilizada em N meses, e
   * estabilizada dali até o mês de saída.
   *
   * É um chute inicial — as células ficam editáveis depois. A confirmação é
   * obrigatória porque isto SUBSTITUI a curva inteira, e é a única operação da
   * aba que apaga input do usuário.
   */
  const gerarRampa = () => {
    const inicio = Math.max(1, Math.trunc(inicioLeaseUpEfetivo) || 1);
    const meses = Math.max(1, Math.trunc(mesesAteEstabilizar) || 1);
    const alvo = loc.ocupacaoEstabilizadaPct || 0;
    if (
      curva.length > 0 &&
      !window.confirm(
        `Isto substitui a curva atual (${curva.length} ${curva.length === 1 ? 'mês' : 'meses'}). Continuar?`,
      )
    ) {
      return;
    }
    const nova: PontoOcupacao[] = [];
    // A curva vai até o FIM DA JANELA, não até o prazo total: depois da venda o
    // dono é o comprador, e `ocupacao_fora_da_janela` acenderia âmbar à toa.
    const fim = fimOperacao;
    for (let m = inicio; m <= fim; m++) {
      const passo = m - inicio + 1;
      const fracao = Math.min(1, passo / meses);
      nova.push({ mes: m, ocupacaoPct: Number((alvo * fracao).toFixed(6)) });
    }
    alterar({ ocupacao: nova });
  };

  /**
   * NOI anual numa dada ocupação — a MESMA álgebra do motor, e é por isso que a
   * tabela bate com o fluxo:
   *
   *   NOI(o) = o × receita100 × (1 − perdaCrédito)
   *            − (opexBruto − opexReembolsável × taxaReembolso × o)
   *
   * O OPEX bruto NÃO varia com a ocupação; o reembolso, sim. É daí que sai o
   * NOI negativo em ocupação baixa.
   */
  const noiNaOcupacao = (o: number) =>
    o * receitaAnual * (1 - loc.perdaCreditoPct) -
    (opexBrutoAnual - opexReembolsavelAnual * loc.taxaReembolsoPct * o);

  const breakeven = resultado.indicadores.ocupacaoBreakevenNoi;

  return (
    <div className="space-y-6">
      <FinanceDetailSectionCard
        title="Janela de operação"
        description="O período em que o ativo opera. Antes da entrega não há OPEX nem aluguel; depois da venda, o ativo não é mais do projeto."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Mês de início da operação</Label>
            <Input
              className={financeDetailFieldClassName}
              type="number"
              min={1}
              // VAZIO É O ESTADO NORMAL, não um campo por preencher: vazio
              // significa "derivado do cronograma". Por isso o placeholder mostra
              // o valor derivado em vez de um traço, e o texto de apoio diz isso
              // com todas as letras.
              value={loc.mesInicioOpex ?? ''}
              placeholder={`mês ${inicioDerivado} · derivado do cronograma`}
              onChange={(e) =>
                mudarLoc({
                  mesInicioOpex: e.target.value === '' ? null : Math.trunc(Number(e.target.value)),
                })
              }
            />
            <p className="text-xs leading-5 text-slate-500">
              Deixe VAZIO para derivar do cronograma — mês de fim da obra mais um, hoje o mês{' '}
              <strong className="tabular-nums text-slate-700">{inicioDerivado}</strong>. Vazio é o
              estado normal, não um campo por preencher. Preencha só quando a data do certificado
              de ocupação não bater com a entrega da obra — há quem conte a partir do último mês de
              obra.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-500">Fim da operação</Label>
            <div
              className={`${financeDetailFieldClassName} flex items-center bg-slate-50 tabular-nums text-slate-700`}
            >
              mês {fimOperacao} · {mesAno(cron.dataFimOperacao)} · mês de saída
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Não é configurável: é o mês de saída, da aba Locação e saída. Continuar recebendo
              aluguel de um imóvel vendido não é um cenário, é um erro.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-500">Duração da janela</Label>
            <div
              className={`${financeDetailFieldClassName} flex items-center bg-slate-50 tabular-nums ${
                janelaVazia ? 'text-red-700' : 'text-slate-700'
              }`}
            >
              {janelaVazia
                ? 'o ativo nunca opera'
                : `${duracaoJanela} ${duracaoJanela === 1 ? 'mês' : 'meses'}`}
            </div>
            <p className="text-xs leading-5 text-slate-500">
              {janelaVazia ? (
                <>
                  A saída (mês {fimOperacao}) é anterior à entrega (mês {inicioOperacao}): não há
                  aluguel, não há NOI e, no modo &quot;últimos 12 meses&quot;, não há valor de
                  saída.
                </>
              ) : (
                <>
                  Do mês {inicioOperacao} ({mesAno(cron.dataInicioOperacao)}) ao {fimOperacao} (
                  {mesAno(cron.dataFimOperacao)}).
                </>
              )}
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Despesas operacionais (OPEX)"
        description="Taxa anual por pé quadrado de ABL. O OPEX BRUTO corre igual em todo mês da JANELA DE OPERAÇÃO — prédio vazio custa property tax, seguro e manutenção igual. O que varia com a ocupação é o reembolso. Fora da janela é zero: antes da entrega não há prédio para pagar imposto e seguro."
        action={
          <Button type="button" variant="outline" onClick={acrescentarLinha}>
            <Plus className="mr-2 h-4 w-4" />
            Nova linha
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Despesa</th>
                <th className="px-3 py-2 text-right">$/sf/ano</th>
                <th className="px-3 py-2 text-right">$/ano</th>
                <th className="px-3 py-2 text-right">% da receita bruta</th>
                <th className="px-3 py-2 text-center">Reembolsável</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const anual = anualDaLinha(l);
                return (
                  <tr key={l.id ?? i} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Input
                        className="h-8"
                        value={l.label}
                        onChange={(e) => mudarLinha(i, { label: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="ml-auto h-8 w-24 text-right tabular-nums"
                        value={l.valorSfAno}
                        onChange={(e) => mudarLinha(i, { valorSfAno: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{dinheiro(anual, moeda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {receitaAnual > 0 ? percentual(anual / receitaAnual) : 'n/d'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={l.reembolsavel !== false}
                        onCheckedChange={(v) => mudarLinha(i, { reembolsavel: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => removerLinha(i)}
                        title="Remover linha"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma linha de OPEX. Sem elas o NOI vira a receita inteira, e nenhum prédio
                    opera de graça.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {linhas.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 font-semibold text-slate-900">
                  <td className="px-3 py-2">Subtotal</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {abl > 0 ? numero(opexBrutoAnual / abl) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{dinheiro(opexBrutoAnual, moeda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {receitaAnual > 0 ? percentual(opexBrutoAnual / receitaAnual) : 'n/d'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-normal text-slate-500">
                    {dinheiro(opexReembolsavelAnual, moeda)} na base
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Taxa de reembolso NNN (%)</Label>
            <Input
              className={financeDetailFieldClassName}
              type="number"
              step="0.01"
              min={0}
              value={pctCampo(loc.taxaReembolsoPct)}
              onChange={(e) => mudarLoc({ taxaReembolsoPct: lerPct(e.target.value) })}
            />
            <p className="text-xs leading-5 text-slate-500">
              Fração do OPEX reembolsável que os inquilinos devolvem. Incide só sobre as linhas
              marcadas como reembolsáveis, e é proporcional à ocupação — só quem está lá paga.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Perda de crédito (%)</Label>
            <Input
              className={financeDetailFieldClassName}
              type="number"
              step="0.01"
              min={0}
              value={pctCampo(loc.perdaCreditoPct)}
              onChange={(e) => mudarLoc({ perdaCreditoPct: lerPct(e.target.value) })}
            />
            <p className="text-xs leading-5 text-slate-500">
              Incide sobre a receita EFETIVAMENTE FATURADA. Não é vacância: a vacância física já
              está na curva de ocupação, e somar as duas contaria o mesmo buraco duas vezes.
            </p>
          </div>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="Curva de ocupação"
        description="Mês SEM linha é ocupação ZERO, não ocupação padrão — o oposto da curva do benchmark. Ocupação é um fato do lease-up, e inventar valor para o mês não declarado criaria receita que ninguém projetou."
      >
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs" title="Nasce no mês de início da operação e acompanha a janela até você digitar outro valor.">
              Início do lease-up (mês)
            </Label>
            <Input
              type="number"
              min={1}
              className="h-9"
              value={inicioLeaseUpEfetivo}
              onChange={(e) => setInicioLeaseUp(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Meses até estabilizar</Label>
            <Input
              type="number"
              min={1}
              className="h-9"
              value={mesesAteEstabilizar}
              onChange={(e) => setMesesAteEstabilizar(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Ocupação estabilizada (%)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className="h-9"
              value={pctCampo(loc.ocupacaoEstabilizadaPct)}
              onChange={(e) => mudarLoc({ ocupacaoEstabilizadaPct: lerPct(e.target.value) })}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" onClick={gerarRampa}>
              <Wand2 className="mr-2 h-4 w-4" />
              Gerar rampa linear
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 bg-white px-3 py-2">Mês</th>
                {Array.from({ length: prazo }, (_, k) => k + 1).map((m) => (
                  <th
                    key={m}
                    className={`px-1 py-2 text-center font-normal ${
                      foraDaJanela(m) ? 'bg-slate-100/70 text-slate-400' : ''
                    }`}
                  >
                    {m}
                    <div className="text-[10px] text-slate-400">
                      {mesAno(resultado.meses[m - 1]?.data ?? '')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-900">
                  Ocupação
                </td>
                {Array.from({ length: prazo }, (_, k) => k + 1).map((m) => {
                  const v = ocupacaoDoMes(m);
                  // Fora da janela o ponto continua na tela e no banco, apenas
                  // INATIVO — em cinza, com o title dizendo por quê. Sumir da
                  // tela seria apagar input do usuário aos olhos dele.
                  const inativo = foraDaJanela(m);
                  return (
                    <td key={m} className={`px-0.5 py-1 ${inativo ? 'bg-slate-100/70' : ''}`}>
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        // Percentual na tela, fração no modelo. A conversão vive
                        // só aqui — o motor e o banco não conhecem "85".
                        value={v === null ? '' : Number((v * 100).toFixed(4))}
                        placeholder="—"
                        title={
                          !inativo
                            ? undefined
                            : m < inicioOperacao
                              ? `Fora da janela de operação: o ativo só passa a operar no mês ${inicioOperacao}, e antes da entrega não existe prédio para alugar. O ponto fica GUARDADO e inativo — se você antecipar a entrega ou o mês de início da operação, ele volta a valer sozinho.`
                              : `Fora da janela de operação: o ativo é vendido no mês ${fimOperacao} e a partir dali o dono é o comprador. O ponto fica GUARDADO e inativo — se a saída for adiada, ele volta a valer sozinho.`
                        }
                        className={`h-8 w-14 px-1 text-center tabular-nums ${
                          inativo ? 'border-slate-200 bg-slate-100 text-slate-400' : ''
                        }`}
                        onChange={(e) =>
                          definirMes(m, e.target.value === '' ? null : Number(e.target.value) / 100)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </FinanceDetailSectionCard>

      <FinanceDetailSectionCard
        title="NOI por faixa de ocupação"
        description="A leitura mais útil da pro forma: onde o prédio começa a se pagar. O OPEX bruto corre inteiro desde o primeiro mês e só o reembolso acompanha a ocupação — por isso o NOI é negativo embaixo."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Ocupação</th>
                <th className="px-3 py-2 text-right">Receita efetiva</th>
                <th className="px-3 py-2 text-right">Reembolso</th>
                <th className="px-3 py-2 text-right">OPEX líquido</th>
                <th className="px-3 py-2 text-right">NOI anual</th>
                <th className="px-3 py-2 text-right">Valor pelo cap</th>
              </tr>
            </thead>
            <tbody>
              {FAIXAS.map((o) => {
                const receita = o * receitaAnual * (1 - loc.perdaCreditoPct);
                const reembolso = opexReembolsavelAnual * loc.taxaReembolsoPct * o;
                const opexLiquido = opexBrutoAnual - reembolso;
                const noi = noiNaOcupacao(o);
                const valor = loc.capRateSaida > 0 ? noi / loc.capRateSaida : null;
                return (
                  <tr key={o} className={`border-b last:border-0 ${noi < 0 ? 'bg-red-50/60' : ''}`}>
                    <td className="px-3 py-2 font-medium tabular-nums text-slate-900">
                      {percentual(o, 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{dinheiro(receita, moeda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {dinheiro(reembolso, moeda)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{dinheiro(opexLiquido, moeda)}</td>
                    <td
                      className={`px-3 py-2 text-right font-semibold tabular-nums ${
                        noi < 0 ? 'text-red-700' : 'text-slate-900'
                      }`}
                    >
                      {dinheiro(noi, moeda)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {valor === null ? 'n/d' : dinheiro(Math.max(0, valor), moeda)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          {breakeven === null ? (
            <>
              Sem aluguel e sem reembolso não há ocupação que cubra o OPEX — o breakeven não existe.
            </>
          ) : (
            <>
              O NOI zera em{' '}
              <strong className="tabular-nums text-slate-900">{percentual(breakeven)}</strong> de
              ocupação; abaixo disso o prédio dá prejuízo operacional. Cobrindo também os juros, o
              breakeven sobe para{' '}
              <strong className="tabular-nums text-slate-900">
                {percentual(resultado.indicadores.ocupacaoBreakevenJuros)}
              </strong>
              .
            </>
          )}
        </p>
      </FinanceDetailSectionCard>
    </div>
  );
}
