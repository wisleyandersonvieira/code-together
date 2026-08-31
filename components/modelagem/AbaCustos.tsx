'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FinanceDetailSectionCard } from '@/components/finance/detail-ui';
import type {
  BaseCalculoCusto,
  CategoriaCusto,
  CustoAdicional,
  DistribuicaoCusto,
  GatilhoCusto,
  ModelInput,
  ModelOutput,
  ParcelaCusto,
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
  somarMeses,
  SUFIXO_BASE_CALCULO,
} from '@/lib/modelagem';
import { dinheiro, percentual as fmtPct, mesAno } from './formato';

interface Props {
  rascunho: ModelInput;
  alterar: (patch: Partial<ModelInput>) => void;
  resultado: ModelOutput;
}

/** Respeita prefers-reduced-motion no scroll ate o custo recem-criado. */
const rolagemSuave = (): ScrollBehavior => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  } catch {
    return 'auto';
  }
};

/** Mesma lista do gerador de aportes: o usuário não aprende duas gramáticas. */
const PERIODICIDADES = [
  { valor: '1', rotulo: 'Mensal' },
  { valor: '2', rotulo: 'Bimestral' },
  { valor: '3', rotulo: 'Trimestral' },
  { valor: '6', rotulo: 'Semestral' },
];

/** Centavos, para a soma das parcelas fechar exatamente com o total pedido. */
const centavos = (v: number) => Math.round(v * 100) / 100;

const celulaParcela = 'h-9 rounded-lg border-slate-200 bg-white px-2 text-right text-sm tabular-nums';
const cabecalhoParcela = 'px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500';

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

  /**
   * Uma linha do orçamento está QUEBRADA quando entra no fluxo como zero sem o
   * usuário ter pedido isso — referência circular, ou base sem denominador.
   * Espelha a leitura das conferências `custo_referencia_circular` e
   * `custo_base_zerada`; um custo quebrado escondido dentro de um acordeão é
   * pior que a tela comprida de antes, então a faixa recolhida precisa saber.
   */
  const quebrada = (c: CustoAdicional, i: number) => {
    if (emCiclo.has(i)) return true;
    if (c.baseCalculo === 'por_unidade' || c.baseCalculo === 'por_sf') return denominador(c) <= 0;
    if (c.baseCalculo === 'pct_de_grupo') {
      return (resolucao.referencias[c.grupoReferencia ?? 'vertical'] ?? 0) <= 0;
    }
    return false;
  };

  // ─── Acordeão ──────────────────────────────────────────────────────────────
  // Estado SÓ de interface: não vai para o banco, não entra no ModelInput, não
  // aparece no diff de salvamento. Indexado pelo índice REAL da linha em
  // `custos` — o mesmo que o agrupamento por categoria preserva.
  const idBase = useId();
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const alternar = (i: number) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      // Várias abertas ao mesmo tempo: editar dois custos relacionados é comum.
      if (proximo.has(i)) proximo.delete(i);
      else proximo.add(i);
      return proximo;
    });
  const recolher = (i: number) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      proximo.delete(i);
      return proximo;
    });

  // ─── Parcelamento do gatilho 'mês fixo' ────────────────────────────────────
  // O switch é DERIVADO de `parcelas.length > 0`, não guardado à parte: é o
  // mesmo critério que o motor usa para decidir entre parcelas e mês âncora, e
  // um estado próprio poderia dizer "ligado" com o fluxo lançando pela âncora.
  const prazoTotal = resultado.cronograma.prazoTotal;
  const dataDoMes = (mes: number) => mesAno(somarMeses(rascunho.dataInicio, Math.max(1, mes) - 1));

  /** Sempre por mês: a tabela não tem outra ordem possível. */
  const parcelasDe = (c: CustoAdicional) =>
    [...(c.parcelas ?? [])].sort((a, b) => a.mes - b.mes || a.ordem - b.ordem);

  /** Grava já reordenado e renumerando `ordem` — o índice é a ordem no banco. */
  const gravarParcelas = (i: number, novas: ParcelaCusto[]) =>
    mudar(i, {
      parcelas: [...novas]
        .sort((a, b) => a.mes - b.mes || a.ordem - b.ordem)
        .map((p, k) => ({ ...p, ordem: k })),
    });

  const mudarParcela = (i: number, alvo: ParcelaCusto, patch: Partial<ParcelaCusto>) =>
    gravarParcelas(
      i,
      parcelasDe(custos[i]).map((p) => (p === alvo ? { ...p, ...patch } : p)),
    );

  /**
   * Dois meses iguais NÃO são erro aqui — a tabela não tem UNIQUE (custo_id, mes)
   * e o motor soma —, então a parcela nova entra no mês seguinte ao último só
   * por conveniência, não por restrição.
   */
  const adicionarParcela = (i: number) => {
    const atuais = parcelasDe(custos[i]);
    const ultimo = atuais.length > 0 ? atuais[atuais.length - 1].mes : (custos[i].mesAncora ?? 0);
    gravarParcelas(i, [...atuais, { ordem: atuais.length, mes: Math.max(1, ultimo + 1), valor: 0 }]);
  };

  /**
   * Liga e desliga o parcelamento.
   *
   * Ligar cria UMA parcela com o valor efetivo inteiro no mês âncora: o fluxo
   * naquele instante fica idêntico ao de antes do clique, e só muda quando o
   * usuário mexer. Desligar apaga as parcelas — e por isso pergunta antes, já que
   * a partir daí quem manda volta a ser o mês âncora.
   */
  const alternarParcelamento = (i: number, ligar: boolean) => {
    const c = custos[i];
    if (ligar) {
      gravarParcelas(i, [{ ordem: 0, mes: Math.max(1, c.mesAncora ?? 1), valor: efetivo(i) }]);
      return;
    }
    const n = (c.parcelas ?? []).length;
    if (
      n > 0 &&
      !window.confirm(
        `Isto remove as ${n} parcela(s) deste custo. Ele volta a lançar 100% no mês âncora. Continuar?`,
      )
    ) {
      return;
    }
    mudar(i, { parcelas: [] });
  };

  // Estado do gerador, por índice de custo. Só de interface, como o acordeão.
  const [geradores, setGeradores] = useState<
    Record<number, { quantidade: number; mesInicial: number; passo: string }>
  >({});
  const geradorDe = (i: number) =>
    geradores[i] ?? { quantidade: 4, mesInicial: Math.max(1, custos[i]?.mesAncora ?? 1), passo: '1' };
  const mudarGerador = (i: number, patch: Partial<ReturnType<typeof geradorDe>>) =>
    setGeradores((atual) => ({ ...atual, [i]: { ...geradorDe(i), ...patch } }));

  /**
   * Divide o valor efetivo do custo igualmente e joga o resíduo do arredondamento
   * na ÚLTIMA parcela: a soma fecha no centavo com o valor do custo, sempre.
   *
   * Mesmo gerador da aba Aportes, com uma diferença: o total não é digitado, é o
   * valor efetivo do custo — que numa base derivada nem é editável.
   */
  const gerarParcelas = (i: number) => {
    const g = geradorDe(i);
    const n = Math.max(1, Math.trunc(g.quantidade) || 1);
    const passo = Math.max(1, Number(g.passo) || 1);
    const inicio = Math.max(1, Math.trunc(g.mesInicial) || 1);
    const total = efetivo(i);

    const fatia = centavos(total / n);
    const novas: ParcelaCusto[] = [];
    for (let k = 0; k < n; k++) {
      novas.push({
        ordem: k,
        mes: inicio + k * passo,
        valor: k === n - 1 ? centavos(total - fatia * (n - 1)) : fatia,
      });
    }

    const fora = novas.filter((p) => p.mes > prazoTotal);
    if (
      fora.length > 0 &&
      !window.confirm(
        `${fora.length} parcela(s) caem além do mês ${prazoTotal}, o fim do cronograma, e não entram no fluxo. ` +
          'Gerar assim mesmo? (a conferência vai acusar)',
      )
    ) {
      return;
    }
    const existentes = (custos[i].parcelas ?? []).length;
    if (
      existentes > 0 &&
      !window.confirm(`Isto substitui as ${existentes} parcelas já lançadas. Continuar?`)
    ) {
      return;
    }
    gravarParcelas(i, novas);
  };

  // Custo recém-criado nasce expandido e a tela rola até ele.
  const [recemCriado, setRecemCriado] = useState<number | null>(null);
  const refsLinhas = useRef(new Map<number, HTMLDivElement>());
  useEffect(() => {
    if (recemCriado == null) return;
    refsLinhas.current.get(recemCriado)?.scrollIntoView({
      behavior: rolagemSuave(),
      block: 'center',
    });
    setRecemCriado(null);
  }, [recemCriado]);

  const adicionar = () => {
    const indice = custos.length;
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
          // Zero parcelas é o comportamento de sempre: o gatilho 'mes_fixo'
          // lança 100% no mês âncora até o usuário ligar o parcelamento.
          parcelas: [],
        },
      ],
    });
    setAbertos((atual) => new Set(atual).add(indice));
    setRecemCriado(indice);
  };

  return (
    <FinanceDetailSectionCard
      title="Orçamento"
      description="Custos que não pertencem a nenhuma unidade específica: sitework, contingência, soft costs, taxas. A categoria agrupa para os subtotais e não altera o lançamento no tempo."
      action={
        <div className="flex items-center gap-2">
          {/* Só aparece quando há o que recolher. */}
          {abertos.size > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-500"
              onClick={() => setAbertos(new Set())}
            >
              Recolher todos
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={adicionar}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar custo
          </Button>
        </div>
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

            {g.linhas.map(({ c, i }) => {
              const aberto = abertos.has(i);
              const comErro = quebrada(c, i);
              const idPainel = `${idBase}-custo-${i}`;
              return (
                <div
                  key={c.id ?? `novo-${i}`}
                  ref={(el) => {
                    if (el) refsLinhas.current.set(i, el);
                    else refsLinhas.current.delete(i);
                  }}
                  className={cn(
                    'overflow-hidden rounded-xl border bg-white',
                    comErro ? 'border-red-300' : 'border-slate-200',
                    c.grupoPaiId != null && 'md:ml-6',
                  )}
                >
                  {/*
                    Faixa recolhida. O Trash2 é IRMÃO do botão de expandir, não
                    filho: botão dentro de botão é HTML inválido e o teclado se
                    perde nele.
                  */}
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => alternar(i)}
                      aria-expanded={aberto}
                      aria-controls={idPainel}
                      className="flex min-h-[48px] flex-1 items-center gap-3 px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset"
                    >
                      {comErro ? (
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-red-600"
                        />
                      ) : null}

                      {/* Nunca anônima: sem descrição a linha diz que está sem. */}
                      {c.label ? (
                        <span className="truncate text-sm font-medium text-slate-800">{c.label}</span>
                      ) : (
                        <span className="truncate text-sm font-medium italic text-slate-400">
                          Sem descrição
                        </span>
                      )}

                      {/* As duas escolhas que mudam o comportamento da linha. */}
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {ROTULO_BASE_CALCULO[c.baseCalculo]}
                        </span>
                        {/* Um custo parcelado precisa dizer isso SEM ser expandido:
                            "Mês fixo" sozinho sugeriria um lançamento único. */}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {ROTULO_GATILHO[c.gatilho]}
                          {c.gatilho === 'mes_fixo' && (c.parcelas ?? []).length > 0
                            ? ` · ${(c.parcelas ?? []).length} ${
                                (c.parcelas ?? []).length === 1 ? 'parcela' : 'parcelas'
                              }`
                            : ''}
                        </span>
                      </span>

                      <span className="flex-1" />

                      {/* O valor EFETIVO, resolvido por `resolverCustos` — não o
                          valor bruto do input, que em por_unidade ou pct_de_grupo
                          não é o que entra no fluxo. */}
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                        {dinheiro(efetivo(i), moeda)}
                      </span>

                      <span className="sr-only">{aberto ? 'Recolher custo' : 'Expandir custo'}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          'h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none',
                          aberto && 'rotate-180',
                        )}
                      />
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover custo"
                      className="mr-2 h-9 w-9 shrink-0 text-slate-400 hover:text-red-600"
                      onClick={(e) => {
                        // Guarda: se um dia o onClick de expandir subir para a
                        // faixa inteira, remover não pode virar expandir.
                        e.stopPropagation();
                        remover(i);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Bloco expandido — os mesmos campos e a mesma lógica de antes. */}
                  <div
                    id={idPainel}
                    hidden={!aberto}
                    className="space-y-3 border-t border-slate-200 p-4"
                  >
                    {/* Linha 1 — o QUANTO: descrição, categoria, base e valor. */}
                    <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.7fr_1.1fr_1.2fr_1.3fr]">
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
                        {/* Com parcelas o campo fica DESABILITADO, não escondido: o
                            usuário digitou um mês aqui e precisa ver para onde ele
                            foi. Nada é apagado — removendo as parcelas, a âncora
                            volta a mandar. */}
                        <Input
                          type="number"
                          min={1}
                          className="text-right tabular-nums"
                          disabled={
                            c.gatilho === 'mes_fixo'
                              ? (c.parcelas ?? []).length > 0
                              : c.gatilho !== 'cronograma' || c.distribuicao !== 'single_month'
                          }
                          value={c.mesAncora ?? ''}
                          onChange={(e) =>
                            mudar(i, { mesAncora: e.target.value === '' ? null : Number(e.target.value) })
                          }
                        />
                        {c.gatilho === 'mes_fixo' && (c.parcelas ?? []).length > 0 ? (
                          <p className="text-[11px] leading-4 text-amber-700">
                            Ignorado quando há parcelas.
                          </p>
                        ) : c.mesAncora != null && c.gatilho === 'mes_fixo' ? (
                          <p className="text-[11px] leading-4 text-slate-500 tabular-nums">
                            mês {c.mesAncora} · {dataDoMes(c.mesAncora)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Linha 3 — o PARCELAMENTO, só no gatilho 'mês fixo'. */}
                    {c.gatilho === 'mes_fixo' ? (() => {
                      const parcelas = parcelasDe(c);
                      const parcelando = parcelas.length > 0;
                      const somaParcelas = parcelas.reduce((a, p) => a + (p.valor || 0), 0);
                      const alvoCusto = efetivo(i);
                      const dif = somaParcelas - alvoCusto;
                      const g = geradorDe(i);
                      return (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Switch
                              id={`${idPainel}-parcelar`}
                              checked={parcelando}
                              onCheckedChange={(v) => alternarParcelamento(i, v)}
                            />
                            <label
                              htmlFor={`${idPainel}-parcelar`}
                              className="text-sm font-medium text-slate-700"
                            >
                              Parcelar
                            </label>
                            <span className="text-[11px] leading-4 text-slate-500">
                              {parcelando
                                ? 'As parcelas é que lançam no fluxo — o mês âncora fica ignorado.'
                                : 'Desligado, o custo é lançado inteiro no mês âncora.'}
                            </span>
                          </div>

                          {parcelando ? (
                            <>
                              {/* Gerador, no mesmo padrão do de aportes. O total não é
                                  digitado: é o valor efetivo do custo, que numa base
                                  derivada nem é editável. */}
                              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-slate-500">
                                    Quantidade de parcelas
                                  </label>
                                  <Input
                                    type="number"
                                    min={1}
                                    className="text-right tabular-nums"
                                    value={g.quantidade}
                                    onChange={(e) =>
                                      mudarGerador(i, { quantidade: Number(e.target.value) || 1 })
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-slate-500">
                                    Mês da 1ª parcela
                                  </label>
                                  <Input
                                    type="number"
                                    min={1}
                                    className="text-right tabular-nums"
                                    value={g.mesInicial}
                                    onChange={(e) =>
                                      mudarGerador(i, { mesInicial: Number(e.target.value) || 1 })
                                    }
                                  />
                                  <p className="text-[11px] leading-4 text-slate-500 tabular-nums">
                                    mês {Math.max(1, g.mesInicial)} · {dataDoMes(g.mesInicial)}
                                  </p>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-slate-500">
                                    Periodicidade
                                  </label>
                                  <Select
                                    value={g.passo}
                                    onValueChange={(v) => mudarGerador(i, { passo: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PERIODICIDADES.map((pp) => (
                                        <SelectItem key={pp.valor} value={pp.valor}>
                                          {pp.rotulo}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => gerarParcelas(i)}
                                >
                                  <Wand2 className="mr-2 h-4 w-4" />
                                  Gerar parcelas
                                </Button>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[520px] border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className={`${cabecalhoParcela} text-left`}>#</th>
                                      <th className={`${cabecalhoParcela} text-right`}>Mês</th>
                                      <th className={`${cabecalhoParcela} text-right`}>Valor</th>
                                      <th className={`${cabecalhoParcela} text-right`}>% do total</th>
                                      <th className="w-10" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {parcelas.map((pp, k) => {
                                      const foraDoPrazo = pp.mes > prazoTotal;
                                      return (
                                        <tr
                                          key={pp.id ?? `nova-${k}`}
                                          className="border-b border-slate-100 last:border-0"
                                        >
                                          <td className="px-2 py-1.5 text-sm tabular-nums text-slate-500">
                                            {k + 1}
                                          </td>
                                          <td
                                            className="px-1 py-1.5"
                                            title={
                                              foraDoPrazo
                                                ? `Além do mês ${prazoTotal}, o fim do cronograma: a parcela fica guardada e inativa, e não entra no fluxo.`
                                                : undefined
                                            }
                                          >
                                            <Input
                                              type="number"
                                              min={1}
                                              step={1}
                                              className={cn(
                                                celulaParcela,
                                                foraDoPrazo && 'border-amber-400 bg-amber-50 text-amber-800',
                                              )}
                                              value={pp.mes}
                                              onChange={(e) =>
                                                mudarParcela(i, pp, {
                                                  mes: Math.max(1, Number(e.target.value) || 1),
                                                })
                                              }
                                            />
                                            <p
                                              className={cn(
                                                'mt-0.5 pr-2 text-right text-[11px] tabular-nums',
                                                foraDoPrazo ? 'text-amber-700' : 'text-slate-400',
                                              )}
                                            >
                                              mês {pp.mes} · {dataDoMes(pp.mes)}
                                              {foraDoPrazo ? ' · guardada, inativa' : ''}
                                            </p>
                                          </td>
                                          <td className="px-1 py-1.5">
                                            <Input
                                              type="number"
                                              step="any"
                                              className={celulaParcela}
                                              value={pp.valor}
                                              onChange={(e) =>
                                                mudarParcela(i, pp, { valor: Number(e.target.value) || 0 })
                                              }
                                            />
                                          </td>
                                          <td className="px-2 py-1.5 text-right text-sm tabular-nums text-slate-600">
                                            {fmtPct(
                                              somaParcelas > 0 ? (pp.valor || 0) / somaParcelas : null,
                                            )}
                                          </td>
                                          <td className="px-1 py-1.5">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              aria-label="Remover parcela"
                                              className="h-8 w-8 text-slate-400 hover:text-red-600"
                                              onClick={() =>
                                                gravarParcelas(
                                                  i,
                                                  parcelas.filter((x) => x !== pp),
                                                )
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Rodapé: a soma contra o valor do custo. O alvo NÃO é
                                  imposto — quem lança são as parcelas, e a diferença
                                  acende âmbar aqui e na conferência. */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
                                <div className="space-y-0.5">
                                  <div className="flex gap-4 tabular-nums">
                                    <span className="text-slate-500">
                                      Soma das parcelas{' '}
                                      <span className="font-semibold text-slate-900">
                                        {dinheiro(somaParcelas, moeda)}
                                      </span>
                                    </span>
                                    <span className="text-slate-500">
                                      Valor do custo{' '}
                                      <span className="font-semibold text-slate-900">
                                        {dinheiro(alvoCusto, moeda)}
                                      </span>
                                    </span>
                                  </div>
                                  {Math.abs(dif) > 0.01 ? (
                                    <p className="text-[11px] leading-4 text-amber-700 tabular-nums">
                                      {dif > 0 ? 'Excede o valor do custo em ' : 'Falta para o valor do custo '}
                                      {dinheiro(Math.abs(dif), moeda)}. As parcelas é que lançam no fluxo.
                                    </p>
                                  ) : (
                                    <p className="text-[11px] leading-4 text-slate-500">
                                      As parcelas fecham com o valor do custo.
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => adicionarParcela(i)}
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Adicionar parcela
                                </Button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })() : null}

                    {/* Rodapé do bloco expandido. "Concluir" APENAS recolhe — quem
                        persiste é o Salvar do topo, e chamar isto de "Salvar" faria
                        o usuário achar que gravou. */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                      <span className="text-[11px] text-slate-500">
                        Salve a modelagem no topo para gravar.
                      </span>
                      <Button type="button" variant="outline" size="sm" onClick={() => recolher(i)}>
                        <Check className="mr-2 h-4 w-4" />
                        Concluir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                — mês âncora além do último mês, obra com zero meses, parcela em mês
                além do prazo — e também quando as parcelas de um custo não somam o
                valor dele, porque são elas que lançam. Mostrar os dois lado a lado é
                o que torna essa diferença visível. */}
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
