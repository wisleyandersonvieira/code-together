'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { financeDetailFieldClassName, FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type { ModelInput, ModelOutput, ModoVenda, Takedown } from '@/lib/modelagem';
import { dinheiro, mesAno, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const EXPLICACAO_VENDA: Record<ModoVenda, string> = {
  single_exit: 'Todas as unidades vendidas de uma vez, no mês de saída.',
  per_unit: 'Cada TIPOLOGIA vende no seu próprio mês — todas as unidades dela, de uma vez.',
  manual: 'Sem receita automática — só o que for lançado à mão no fluxo.',
  takedown: 'Lotes mensais: N unidades de uma tipologia fechando em cada mês, com preço próprio.',
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

  // ─── Takedowns ─────────────────────────────────────────────────────────────
  const takedowns = rec.takedowns ?? [];
  const fases = rascunho.fases ?? [];
  const [gerarMesInicial, setGerarMesInicial] = useState(1);
  const [gerarMeses, setGerarMeses] = useState(12);

  const mudarTakedown = (i: number, patch: Partial<Takedown>) =>
    mudar({ takedowns: takedowns.map((t, k) => (k === i ? { ...t, ...patch } : t)) });

  /** Preço que o motor vai usar: 0 no lote significa "usar o da tipologia". */
  const precoEfetivo = (t: Takedown) =>
    t.precoUnitario > 0 ? t.precoUnitario : (rascunho.unidades[t.unidadeIndex]?.precoVenda ?? 0);

  const unidadesAlocadas = takedowns.reduce((a, t) => a + Math.max(0, Math.trunc(t.quantidade || 0)), 0);
  const receitaBrutaTakedown = takedowns.reduce(
    (a, t) => a + precoEfetivo(t) * Math.max(0, Math.trunc(t.quantidade || 0)),
    0,
  );

  /**
   * Distribui as unidades de cada tipologia em M meses a partir de um mês inicial.
   *
   * O resto vai nos PRIMEIROS meses — 45 em 12 meses vira 4,4,4,4,4,4,4,4,4,3,3,3.
   * É um chute inicial: as linhas ficam editáveis depois.
   */
  const gerarCronograma = () => {
    const m = Math.max(1, Math.trunc(gerarMeses) || 1);
    const inicio = Math.max(1, Math.trunc(gerarMesInicial) || 1);
    if (
      takedowns.length > 0 &&
      !window.confirm(`Isto substitui os ${takedowns.length} lotes atuais. Continuar?`)
    ) {
      return;
    }
    const novos: Takedown[] = [];
    rascunho.unidades.forEach((u, unidadeIndex) => {
      const total = Math.max(1, Math.trunc(u.quantidade || 1));
      const base = Math.floor(total / m);
      const resto = total % m;
      for (let k = 0; k < m; k++) {
        const quantidade = base + (k < resto ? 1 : 0);
        if (quantidade <= 0) continue;
        novos.push({
          unidadeIndex,
          // A fase não é adivinhada: o vínculo é opcional e existe para a
          // conferência de venda antes da conclusão. Chutar aqui produziria
          // âmbar falso.
          faseIndex: null,
          ordem: novos.length,
          mes: inicio + k,
          quantidade,
          // 0 = usar o preço da tipologia. Não copiamos o número: assim o lote
          // acompanha sozinho qualquer mudança de preço na aba Tipologias.
          precoUnitario: 0,
          observacao: null,
        });
      }
    });
    mudar({ modoVenda: 'takedown', takedowns: novos });
  };

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
                <SelectItem value="per_unit">Por tipologia</SelectItem>
                <SelectItem value="takedown">Takedown (lotes mensais)</SelectItem>
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
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipologia</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Preço (un)</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">VGV da tipologia</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Mês de venda</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {rascunho.unidades.map((u, i) => {
                  const mes = mesDaUnidade(i);
                  const linha = typeof mes === 'number' ? resultado.meses[mes - 1] : undefined;
                  const n = Math.max(1, Math.trunc(u.quantidade || 1));
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-sm text-slate-800">{u.nome || `Tipologia ${i + 1}`}</td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-600">{n}</td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-700">
                        {dinheiro(u.precoVenda, rascunho.moeda)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums text-slate-900">
                        {dinheiro(u.precoVenda * n, rascunho.moeda)}
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
            <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-xs leading-5 text-slate-500">
              O mês vale para a tipologia inteira: as {' '}
              {resultado.agregados.unidadesTotal} unidades entram na receita de uma vez, no mês da linha.
              Venda escalonada dentro de uma tipologia não é suportada — separe em duas linhas na aba
              Tipologias.
            </p>
          </div>
        ) : null}
      </FinanceDetailSectionCard>

      {rec.modoVenda === 'takedown' ? (
        <FinanceDetailSectionCard
          title="Takedown schedule"
          description="Cada linha é um lote: N unidades de uma tipologia fechando num mês. Dois lotes da mesma tipologia no mesmo mês são somados."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                mudar({
                  takedowns: [
                    ...takedowns,
                    {
                      unidadeIndex: 0,
                      faseIndex: null,
                      ordem: takedowns.length,
                      mes: 1,
                      quantidade: 1,
                      precoUnitario: 0,
                      observacao: null,
                    },
                  ],
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar lote
            </Button>
          }
        >
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Mês inicial</Label>
              <Input
                type="number"
                min={1}
                className="h-9 w-24 text-right tabular-nums"
                value={gerarMesInicial}
                onChange={(e) => setGerarMesInicial(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Em quantos meses</Label>
              <Input
                type="number"
                min={1}
                className="h-9 w-24 text-right tabular-nums"
                value={gerarMeses}
                onChange={(e) => setGerarMeses(Number(e.target.value) || 1)}
              />
            </div>
            <Button type="button" variant="outline" onClick={gerarCronograma}>
              Gerar cronograma
            </Button>
            <p className="max-w-md text-xs text-slate-500">
              Distribui as unidades de cada tipologia nesses meses, jogando o resto nos primeiros —
              45 em 12 meses vira 4×9 e 3×3. É um chute inicial: as linhas ficam editáveis.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tipologia</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fase</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Mês</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Data</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Preço (un)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total do lote</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {takedowns.map((t, i) => {
                  const linha = resultado.meses[t.mes - 1];
                  const n = Math.max(0, Math.trunc(t.quantidade || 0));
                  return (
                    <tr key={t.id ?? `novo-${i}`} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <Select
                          value={String(t.unidadeIndex)}
                          onValueChange={(v) => mudarTakedown(i, { unidadeIndex: Number(v) })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rascunho.unidades.map((u, k) => (
                              <SelectItem key={k} value={String(k)}>
                                {u.nome || `Tipologia ${k + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select
                          value={t.faseIndex == null ? 'nenhuma' : String(t.faseIndex)}
                          onValueChange={(v) =>
                            mudarTakedown(i, { faseIndex: v === 'nenhuma' ? null : Number(v) })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhuma">—</SelectItem>
                            {fases.map((f, k) => (
                              <SelectItem key={k} value={String(k)}>
                                {f.nome || `Fase ${k + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min={1}
                          className="ml-auto h-9 w-20 text-right tabular-nums"
                          value={t.mes}
                          onChange={(e) => mudarTakedown(i, { mes: Number(e.target.value) || 1 })}
                        />
                      </td>
                      {/* Data DERIVADA do mês — a tela não guarda data nenhuma. */}
                      <td className="px-3 py-1.5 text-sm text-slate-500">
                        {linha ? mesAno(linha.data) : <span className="text-amber-600">fora do prazo</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          min={1}
                          className="ml-auto h-9 w-20 text-right tabular-nums"
                          value={t.quantidade}
                          onChange={(e) => mudarTakedown(i, { quantidade: Number(e.target.value) || 1 })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="any"
                          className="ml-auto h-9 w-32 text-right tabular-nums"
                          placeholder={String(rascunho.unidades[t.unidadeIndex]?.precoVenda ?? 0)}
                          value={t.precoUnitario || ''}
                          onChange={(e) =>
                            mudarTakedown(i, { precoUnitario: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm font-medium tabular-nums text-slate-900">
                        {dinheiro(precoEfetivo(t) * n, rascunho.moeda)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => mudar({ takedowns: takedowns.filter((_, k) => k !== i) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {takedowns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                      Nenhum lote cadastrado — sem takedown, o modo não lança receita em mês nenhum.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span
              className={
                unidadesAlocadas === resultado.agregados.unidadesTotal
                  ? 'font-medium text-slate-900'
                  : 'font-medium text-red-600'
              }
            >
              {unidadesAlocadas} de {resultado.agregados.unidadesTotal} unidades em lotes
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              Receita bruta: {dinheiro(receitaBrutaTakedown, rascunho.moeda)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Preço em branco usa o preço da tipologia, então o lote acompanha sozinho qualquer mudança
            na aba Tipologias. A receita bruta acima é a soma dos lotes; o que entra no fluxo é ela
            menos comissão e cartório.
          </p>
        </FinanceDetailSectionCard>
      ) : null}
    </div>
  );
}
