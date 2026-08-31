'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type {
  CategoriaCusto,
  CustoAdicional,
  DistribuicaoCusto,
  ModelInput,
  ModelOutput,
} from '@/lib/modelagem';
import { CATEGORIAS_CUSTO, ROTULO_CATEGORIA } from '@/lib/modelagem';
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

  const totalOrcamento = custos.reduce((a, c) => a + (c.valor || 0), 0);

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
              </span>
            </div>

            {g.linhas.map(({ c, i }) => (
              <div
                key={c.id ?? `novo-${i}`}
                className={`grid grid-cols-1 items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[2fr_1.2fr_1fr_1.4fr_1fr_auto] ${
                  c.grupoPaiId != null ? 'md:ml-6' : ''
                }`}
              >
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
                    onChange={(e) =>
                      mudar(i, { mesAncora: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
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
              <span className="tabular-nums">{dinheiro(totalOrcamento, moeda)}</span>
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
