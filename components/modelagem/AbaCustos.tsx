'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type {
  BaseCalculoCusto,
  CategoriaCusto,
  CustoAdicional,
  DistribuicaoCusto,
  GatilhoCusto,
  ModelInput,
  ModelOutput,
} from '@/lib/modelagem';
import {
  BASES_CALCULO_CUSTO,
  basesDeCalculo,
  CATEGORIAS_CUSTO,
  EXPLICACAO_GATILHO,
  GATILHOS_CUSTO,
  resolverCustos,
  ROTULO_BASE_CALCULO,
  ROTULO_CATEGORIA,
  ROTULO_GATILHO,
  SUFIXO_BASE_CALCULO,
} from '@/lib/modelagem';
import { dinheiro, percentual as fmtPct } from './formato';

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
  const moeda = rascunho.moeda;

  const mudar = (i: number, patch: Partial<CustoAdicional>) =>
    alterar({ custosAdicionais: custos.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  /**
   * Remover uma linha solta o que ela agrupava em vez de escondê-lo.
   *
   * Mesma escolha do ON DELETE SET NULL da migration 1761200000: o custo do
   * filho é input do usuário e não pode sumir da tela porque o pai saiu.
   */
  const remover = (i: number) => {
    const removido = custos[i];
    alterar({
      custosAdicionais: custos
        .filter((_, k) => k !== i)
        .map((c) =>
          removido.id != null && c.grupoPaiId === removido.id ? { ...c, grupoPaiId: null } : c,
        ),
    });
  };

  /**
   * Agrupa para EXIBIÇÃO apenas, preservando o índice real de cada linha.
   *
   * O índice do array é a `ordem` gravada no banco (ver `sincronizar` em
   * ModelagemEditor), então reordenar de verdade reescreveria a ordem de todo
   * mundo a cada salvamento. Aqui as linhas saem por categoria e, dentro dela,
   * na ordem em que já estão — e toda edição continua endereçando `i`.
   */
  const grupos = CATEGORIAS_CUSTO.map((categoria) => ({
    categoria,
    linhas: custos
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.categoria === categoria),
  })).filter((g) => g.linhas.length > 0);

  /**
   * Candidatos a pai dentro da categoria: só linhas JÁ GRAVADAS (com id), porque
   * `grupo_pai` é uma FK e uma linha ainda sem id não tem para onde apontar.
   * Quem já é filho não aparece — a hierarquia tem dois níveis, não mais.
   */
  const paisPossiveis = (i: number) =>
    custos
      .map((c, k) => ({ c, k }))
      .filter(
        ({ c, k }) =>
          k !== i && c.id != null && c.categoria === custos[i].categoria && c.grupoPaiId == null,
      );

  /**
   * Orçamento resolvido pelas MESMAS funções puras que o motor usa — inclusive a
   * detecção de ciclo. A tela não tem conta própria: se divergir do fluxo, é bug
   * de leitura, não de cálculo.
   */
  const bases = basesDeCalculo(rascunho.unidades ?? []);
  const resolucao = resolverCustos(custos, bases, {
    terreno: resultado.agregados.terrenosTotal,
    vertical: resultado.agregados.obraTotal,
  });
  const emCiclo = new Set(resolucao.circulares);
  const efetivo = (i: number) => resolucao.valores[i] ?? 0;
  const denominador = (c: CustoAdicional) =>
    c.baseCalculo === 'por_unidade' ? bases.unidades : c.baseCalculo === 'por_sf' ? bases.areaSf : 0;

  const totalOrcamento = resolucao.valores.reduce((a, v) => a + v, 0);

  return (
    <FinanceDetailSectionCard
      title="Orçamento"
      description="Custos que não pertencem a nenhuma unidade específica: sitework, contingência, soft costs, taxas. A categoria agrupa para os subtotais e não altera o lançamento no tempo."
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            alterar({
              custosAdicionais: [
                ...custos,
                {
                  label: '',
                  valor: 0,
                  distribuicao: 'linear_construction',
                  mesAncora: null,
                  categoria: 'outros',
                  grupoPaiId: null,
                  baseCalculo: 'total',
                  valorUnitario: 0,
                  grupoReferencia: null,
                  percentual: 0,
                  gatilho: 'cronograma',
                },
              ],
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar custo
        </Button>
      }
    >
      <div className="space-y-5">
        {grupos.map((g) => (
          <div key={g.categoria} className="space-y-2">
            <div className="flex items-baseline justify-between rounded-lg bg-slate-100 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {ROTULO_CATEGORIA[g.categoria]}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {dinheiro(resultado.agregados.custosPorCategoria[g.categoria], moeda)}
                {/* $/unidade em toda linha do orçamento, que é como uma pro forma
                    se lê. Sem unidade cadastrada não há denominador: some. */}
                {resultado.agregados.unidadesTotal > 0 ? (
                  <span className="ml-2 font-normal text-slate-500">
                    {dinheiro(
                      resultado.agregados.custosPorCategoria[g.categoria] /
                        resultado.agregados.unidadesTotal,
                      moeda,
                    )}
                    /un.
                  </span>
                ) : null}
              </span>
            </div>

            {g.linhas.map(({ c, i }) => (
              <div
                key={c.id ?? `novo-${i}`}
                className={`space-y-3 rounded-2xl border bg-white p-4 ${
                  emCiclo.has(i) ? 'border-red-300' : 'border-slate-200'
                } ${c.grupoPaiId != null ? 'md:ml-6' : ''}`}
              >
                {/* Linha 1 — o QUANTO: descrição, categoria, base e valor. */}
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.7fr_1.1fr_1.2fr_1.3fr_auto]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Descrição</label>
                    <Input
                      value={c.label}
                      onChange={(e) => mudar(i, { label: e.target.value })}
                      placeholder="Contingência"
                    />
                    {paisPossiveis(i).length > 0 ? (
                      <Select
                        value={c.grupoPaiId == null ? 'raiz' : String(c.grupoPaiId)}
                        onValueChange={(v) => mudar(i, { grupoPaiId: v === 'raiz' ? null : Number(v) })}
                      >
                        <SelectTrigger className="h-7 text-[11px] text-slate-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="raiz">Primeiro nível</SelectItem>
                          {paisPossiveis(i).map(({ c: p, k }) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              Dentro de {p.label || `Custo ${k + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Categoria</label>
                    <Select
                      value={c.categoria}
                      onValueChange={(v) =>
                        // Trocar de categoria desfaz o agrupamento: o pai ficou noutro
                        // grupo, e manter o vínculo deixaria a linha indentada sob algo
                        // que a tela não mostra mais ao lado dela.
                        mudar(i, { categoria: v as CategoriaCusto, grupoPaiId: null })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_CUSTO.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {ROTULO_CATEGORIA[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Base</label>
                    <Select
                      value={c.baseCalculo}
                      onValueChange={(v) =>
                        mudar(i, {
                          baseCalculo: v as BaseCalculoCusto,
                          // O banco exige grupo de referência quando a base é
                          // percentual (modelagem_custos_pct_grupo_ck). Preencher
                          // aqui é o que impede o salvamento de falhar por uma
                          // escolha que a própria tela ofereceu.
                          ...(v === 'pct_de_grupo' && c.grupoReferencia == null
                            ? { grupoReferencia: 'vertical' as CategoriaCusto }
                            : {}),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BASES_CALCULO_CUSTO.map((b) => (
                          <SelectItem key={b} value={b}>
                            {ROTULO_BASE_CALCULO[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">
                      {c.baseCalculo === 'total'
                        ? 'Valor'
                        : c.baseCalculo === 'pct_de_grupo'
                          ? 'Percentual'
                          : `Unitário${SUFIXO_BASE_CALCULO[c.baseCalculo]}`}
                    </label>
                    {/* Um campo só, e nunca dois ao mesmo tempo: `valor`,
                        `valorUnitario` e `percentual` são inputs alternativos, e
                        deixar o total editável numa base derivada convidaria a
                        gravar um número que o motor ignora. Ao trocar de base, o
                        valor anterior fica guardado no banco — nada de input do
                        usuário é apagado. */}
                    <Input
                      type="number"
                      step="any"
                      className="text-right tabular-nums"
                      value={
                        c.baseCalculo === 'total'
                          ? c.valor
                          : c.baseCalculo === 'pct_de_grupo'
                            ? // O banco guarda fração (0.05); a tela fala em
                              // percentual (5), como na aba Receita.
                              c.percentual * 100
                            : c.valorUnitario
                      }
                      onChange={(e) => {
                        const n = Number(e.target.value) || 0;
                        mudar(
                          i,
                          c.baseCalculo === 'total'
                            ? { valor: n }
                            : c.baseCalculo === 'pct_de_grupo'
                              ? { percentual: n / 100 }
                              : { valorUnitario: n },
                        );
                      }}
                    />

                    {c.baseCalculo === 'pct_de_grupo' ? (
                      <>
                        <Select
                          value={c.grupoReferencia ?? 'vertical'}
                          onValueChange={(v) => mudar(i, { grupoReferencia: v as CategoriaCusto })}
                        >
                          <SelectTrigger className="h-7 text-[11px] text-slate-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS_CUSTO.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                sobre {ROTULO_CATEGORIA[cat]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {emCiclo.has(i) ? (
                          // Referência que volta para a própria categoria: o valor
                          // não existe. A conferência `custo_referencia_circular`
                          // repete o aviso no painel, em vermelho.
                          <p className="text-[11px] leading-4 text-red-600">
                            Referência circular — este item incide sobre a própria categoria,
                            direta ou indiretamente, e entra no fluxo como {dinheiro(0, moeda)}.
                          </p>
                        ) : (
                          <p className="text-[11px] leading-4 text-slate-500 tabular-nums">
                            {fmtPct(c.percentual)} de{' '}
                            <span
                              className={
                                (resolucao.referencias[c.grupoReferencia ?? 'vertical'] ?? 0) <= 0
                                  ? 'text-amber-600'
                                  : ''
                              }
                            >
                              {dinheiro(resolucao.referencias[c.grupoReferencia ?? 'vertical'], moeda)}
                            </span>{' '}
                            ({ROTULO_CATEGORIA[c.grupoReferencia ?? 'vertical']}) ={' '}
                            {dinheiro(efetivo(i), moeda)}
                          </p>
                        )}
                      </>
                    ) : c.baseCalculo !== 'total' ? (
                      // A conta acontecendo à vista do usuário. Denominador zero é
                      // dito com todas as letras — a conferência `custo_base_zerada`
                      // repete o aviso no painel.
                      <p className="text-[11px] leading-4 text-slate-500 tabular-nums">
                        × {denominador(c).toLocaleString('pt-BR')}{' '}
                        {c.baseCalculo === 'por_unidade' ? 'un.' : 'sf'} ={' '}
                        <span className={denominador(c) <= 0 ? 'text-amber-600' : ''}>
                          {dinheiro(efetivo(i), moeda)}
                        </span>
                        {c.gatilho === 'por_venda' ? (
                          <span className="text-slate-400"> · lançado conforme as vendas</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-1 h-9 w-9 text-slate-400 hover:text-red-600"
                    onClick={() => remover(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Linha 2 — o QUANDO: gatilho, distribuição e mês âncora. */}
                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1.4fr_1.5fr_0.9fr]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Gatilho</label>
                    <Select
                      value={c.gatilho}
                      onValueChange={(v) => mudar(i, { gatilho: v as GatilhoCusto })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GATILHOS_CUSTO.map((g) => (
                          <SelectItem key={g} value={g}>
                            {ROTULO_GATILHO[g]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] leading-4 text-slate-500">{EXPLICACAO_GATILHO[c.gatilho]}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Distribuição</label>
                    {/* Fora de 'cronograma' o gatilho SUBSTITUI a distribuição.
                        Desabilitar em vez de esconder deixa visível o que ficou
                        guardado — e nada é apagado do banco. */}
                    <Select
                      value={c.distribuicao}
                      disabled={c.gatilho !== 'cronograma'}
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
                    <p className="text-[11px] leading-4 text-slate-500">
                      {c.gatilho === 'cronograma'
                        ? EXPLICACAO[c.distribuicao]
                        : 'Ignorada: quem manda é o gatilho.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Mês âncora</label>
                    <Input
                      type="number"
                      min={1}
                      className="text-right tabular-nums"
                      disabled={
                        c.gatilho === 'mes_fixo'
                          ? false
                          : c.gatilho !== 'cronograma' || c.distribuicao !== 'single_month'
                      }
                      value={c.mesAncora ?? ''}
                      onChange={(e) =>
                        mudar(i, { mesAncora: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {custos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum custo adicional. A modelagem roda normalmente sem eles.
          </p>
        ) : (
          <div className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between font-semibold text-slate-900">
              <span>Total do orçamento</span>
              <span className="tabular-nums">
                {dinheiro(totalOrcamento, moeda)}
                {resultado.agregados.unidadesTotal > 0 ? (
                  <span className="ml-2 font-normal text-slate-500">
                    {dinheiro(totalOrcamento / resultado.agregados.unidadesTotal, moeda)}/un.
                  </span>
                ) : null}
              </span>
            </div>
            {/* Os dois divergem quando algum custo cai fora do prazo do cronograma
                — mês âncora além do último mês, ou obra com zero meses. Mostrar os
                dois lado a lado é o que torna essa perda visível. */}
            <div className="flex justify-between text-slate-500">
              <span>Total lançado no fluxo</span>
              <span className="tabular-nums">{dinheiro(resultado.apuracao.custoOutros, moeda)}</span>
            </div>
          </div>
        )}
      </div>
    </FinanceDetailSectionCard>
  );
}
