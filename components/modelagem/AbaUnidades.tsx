'use client';

import { Plus, Split, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import { cn } from '@/lib/utils';
import type { AlocacaoFase, ModelInput, ModelOutput, Unidade } from '@/lib/modelagem';
import { dinheiro, percentual } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

const celula = 'h-9 rounded-lg border-slate-200 bg-white px-2 text-right text-sm tabular-nums';
const cabecalho = 'px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500';
const lido = 'bg-slate-50/70 px-2 py-1.5 text-right text-sm tabular-nums text-slate-700';

const UNIDADE_NOVA: Unidade = {
  nome: '',
  cidade: '',
  quantidade: 1,
  areaSf: 0,
  custoTerreno: 0,
  custoObra: 0,
  precoVenda: 0,
  propertyTaxAno: 0,
};

/** Quantidade efetiva — mesma regra do motor, para os totais da tela baterem. */
const qtd = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));

export function AbaUnidades({ rascunho, alterar, resultado }: Props) {
  const unidades = rascunho.unidades;
  const fases = rascunho.fases ?? [];
  const alocacoes = rascunho.alocacoes ?? [];

  const mudar = (i: number, patch: Partial<Unidade>) =>
    alterar({ unidades: unidades.map((u, k) => (k === i ? { ...u, ...patch } : u)) });

  // Remover a tipologia leva junto a alocação dela e reindexa o resto: os índices
  // do input são posicionais, então deixar para trás um `unidadeIndex` antigo
  // apontaria para a tipologia errada — silenciosamente.
  const remover = (i: number) =>
    alterar({
      unidades: unidades.filter((_, k) => k !== i),
      alocacoes: alocacoes
        .filter((a) => a.unidadeIndex !== i)
        .map((a) => (a.unidadeIndex > i ? { ...a, unidadeIndex: a.unidadeIndex - 1 } : a)),
    });

  const total = (f: (u: Unidade) => number) => unidades.reduce((a, u) => a + (f(u) || 0), 0);

  // ─── Distribuição por fase ─────────────────────────────────────────────────
  const alocadoEm = (unidadeIndex: number, faseIndex: number) =>
    alocacoes.find((a) => a.unidadeIndex === unidadeIndex && a.faseIndex === faseIndex)?.quantidade ?? 0;

  const alocadoNaTipologia = (unidadeIndex: number) =>
    alocacoes
      .filter((a) => a.unidadeIndex === unidadeIndex)
      .reduce((a, x) => a + (x.quantidade || 0), 0);

  const gravarAlocacoes = (novas: AlocacaoFase[]) =>
    // Célula zerada não vira linha no banco: alocação ausente e alocação de zero
    // significam a mesma coisa, e guardar as duas só cria lixo.
    alterar({ alocacoes: novas.filter((a) => a.quantidade > 0) });

  const mudarAlocacao = (unidadeIndex: number, faseIndex: number, quantidade: number) => {
    const q = Math.max(0, Math.trunc(quantidade) || 0);
    const outras = alocacoes.filter(
      (a) => !(a.unidadeIndex === unidadeIndex && a.faseIndex === faseIndex),
    );
    const anterior = alocacoes.find(
      (a) => a.unidadeIndex === unidadeIndex && a.faseIndex === faseIndex,
    );
    gravarAlocacoes([...outras, { ...anterior, unidadeIndex, faseIndex, quantidade: q }]);
  };

  /** Divide a quantidade da tipologia entre as fases; o resto vai na primeira. */
  const distribuirIgualmente = (unidadeIndex: number) => {
    if (fases.length === 0) return;
    const n = qtd(unidades[unidadeIndex]);
    const base = Math.floor(n / fases.length);
    const resto = n % fases.length;
    const outras = alocacoes.filter((a) => a.unidadeIndex !== unidadeIndex);
    const novas = fases.map((_, faseIndex) => ({
      id: alocacoes.find((a) => a.unidadeIndex === unidadeIndex && a.faseIndex === faseIndex)?.id,
      unidadeIndex,
      faseIndex,
      quantidade: base + (faseIndex < resto ? 1 : 0),
    }));
    gravarAlocacoes([...outras, ...novas]);
  };

  return (
    <div className="space-y-6">
    <FinanceDetailSectionCard
      title="Tipologias"
      description="Cada linha é uma tipologia com N unidades iguais. Os valores da linha são por unidade; os totais consideram a quantidade."
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() => alterar({ unidades: [...unidades, { ...UNIDADE_NOVA }] })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar tipologia
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1300px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={`${cabecalho} text-left`}>Nome</th>
              <th className={`${cabecalho} text-left`}>Cidade</th>
              <th className={`${cabecalho} text-right`}>Qtd</th>
              <th className={`${cabecalho} text-right`}>Área sf</th>
              <th className={`${cabecalho} text-right`}>Terreno</th>
              <th className={`${cabecalho} text-right`}>Obra</th>
              <th className={`${cabecalho} text-right`}>Preço de venda</th>
              <th className={`${cabecalho} text-right`}>Tax/ano</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Terreno total</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Obra total</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>VGV total</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Custo total</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Custo unitário</th>
              <th className={`${cabecalho} bg-slate-50 text-right`}>Margem</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {unidades.map((u, i) => {
              const res = resultado.resultadoUnidades[i];
              const n = qtd(u);
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
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className={celula}
                      value={u.quantidade ?? 1}
                      onChange={(e) =>
                        mudar(i, { quantidade: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })
                      }
                    />
                  </td>
                  {([
                    ['areaSf', u.areaSf],
                    ['custoTerreno', u.custoTerreno],
                    ['custoObra', u.custoObra],
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
                  <td className={lido}>{dinheiro((u.custoTerreno || 0) * n, rascunho.moeda)}</td>
                  <td className={lido}>{dinheiro((u.custoObra || 0) * n, rascunho.moeda)}</td>
                  <td className={lido}>{dinheiro((u.precoVenda || 0) * n, rascunho.moeda)}</td>
                  <td className={lido}>
                    {dinheiro(res?.custoTotal ?? ((u.custoTerreno || 0) + (u.custoObra || 0)) * n, rascunho.moeda)}
                  </td>
                  {/* Tudo incluído: já traz o rateio de property tax, juros e fee.
                      Vem do motor (`custoTotalUnitario`), não de uma divisão feita
                      aqui — a tela não tem conta própria. */}
                  <td className={lido}>{dinheiro(res?.custoTotalUnitario, rascunho.moeda)}</td>
                  <td className={lido}>{percentual(res?.margem)}</td>
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
                <td colSpan={15} className="px-2 py-8 text-center text-sm text-slate-500">
                  Nenhuma tipologia cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
          {unidades.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <td className="px-2 py-2 text-sm" colSpan={2}>
                  Totais ({unidades.length} tipologias · {resultado.agregados.unidadesTotal} unidades)
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {resultado.agregados.unidadesTotal.toLocaleString('en-US')}
                </td>
                {/* Área do projeto inteiro: unitária × quantidade. */}
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {total((u) => (u.areaSf ?? 0) * qtd(u)).toLocaleString('en-US')}
                </td>
                {/* Terreno, Obra, Preço e Tax são POR UNIDADE: somar valores
                    unitários de tipologias diferentes não significa nada. Os
                    totais estão nas colunas calculadas à direita. */}
                <td className="px-2 py-2" colSpan={4} />
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.terrenosTotal, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.obraTotal, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.agregados.vgv, rascunho.moeda)}
                </td>
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(
                    resultado.resultadoUnidades.reduce((a, r) => a + r.custoTotal, 0),
                    rascunho.moeda,
                  )}
                </td>
                {/* Custo médio do projeto por unidade — o mesmo indicador da aba
                    Resultado, e não a média das médias das tipologias. */}
                <td className="px-2 py-2 text-right text-sm tabular-nums">
                  {dinheiro(resultado.indicadores.custoPorUnidade, rascunho.moeda)}
                </td>
                <td className="px-2 py-2" colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </FinanceDetailSectionCard>

    {/* Matriz, não colunas extras na tabela acima: com 5 fases aquela tabela já
        passa de 20 colunas e deixa de ser legível. */}
    {rascunho.usaFases ? (
      <FinanceDetailSectionCard
        title="Distribuição por fase"
        description="Quantas unidades de cada tipologia entram em cada fase. O que não estiver alocado não é lançado no fluxo — por isso a linha precisa fechar para salvar."
      >
        {fases.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Nenhuma fase cadastrada. Cadastre as fases na aba Premissas para distribuir as unidades.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={`${cabecalho} text-left`}>Tipologia</th>
                  {fases.map((f, j) => (
                    <th key={f.id ?? j} className={`${cabecalho} text-right`}>
                      {f.nome || `Fase ${j + 1}`}
                    </th>
                  ))}
                  <th className={`${cabecalho} bg-slate-50 text-right`}>Alocado / Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {unidades.map((u, i) => {
                  const n = qtd(u);
                  const somado = alocadoNaTipologia(i);
                  const fecha = somado === n;
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-1.5 text-sm text-slate-800">
                        {u.nome || `Tipologia ${i + 1}`}
                      </td>
                      {fases.map((f, j) => (
                        <td key={f.id ?? j} className="px-1 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className={celula}
                            value={alocadoEm(i, j)}
                            onChange={(e) => mudarAlocacao(i, j, Number(e.target.value))}
                          />
                        </td>
                      ))}
                      <td
                        className={cn(
                          'bg-slate-50/70 px-2 py-1.5 text-right text-sm font-semibold tabular-nums',
                          fecha ? 'text-emerald-700' : 'text-red-600',
                        )}
                      >
                        {somado} / {n}
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-700"
                          title="Distribuir igualmente entre as fases"
                          onClick={() => distribuirIgualmente(i)}
                        >
                          <Split className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-2 py-2 text-sm">Total por fase</td>
                  {fases.map((f, j) => (
                    <td key={f.id ?? j} className="px-2 py-2 text-right text-sm tabular-nums">
                      {unidades.reduce((a, _u, i) => a + alocadoEm(i, j), 0)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right text-sm tabular-nums">
                    {unidades.reduce((a, _u, i) => a + alocadoNaTipologia(i), 0)} /{' '}
                    {resultado.agregados.unidadesTotal}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </FinanceDetailSectionCard>
    ) : null}
    </div>
  );
}
