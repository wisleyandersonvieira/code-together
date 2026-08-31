'use client';

import { Fragment, useId, useMemo, useState } from 'react';
import { ChevronRight, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  CategoriaCusto,
  DetalheCusto,
  LinhaFluxo,
  MesFluxo,
  ModelInput,
  ModelOutput,
} from '@/lib/modelagem';
import { agruparCustosPorCategoria, aporteSomenteLeitura, AVISO_APORTE_POR_SOCIO, ROTULO_CATEGORIA } from '@/lib/modelagem';
import { dinheiroCurto, mesAno, paraNumero } from './formato';

interface Props {
  rascunho: ModelInput;
  resultado: ModelOutput;
  /** Mesma modelagem sem nenhum override — alimenta o tooltip do valor automático. */
  resultadoAutomatico: ModelOutput;
  aplicarOverride: (mes: number, linha: LinhaFluxo, valor: number | null) => void;
  reverterCelula: (mes: number, linha: LinhaFluxo) => void;
  reverterLinha: (linha: LinhaFluxo) => void;
  reverterTudo: () => void;
}

interface DefinicaoLinha {
  chave: string;
  rotulo: string;
  /** Segunda linha da célula do rótulo, em corpo menor. Só o que precisa. */
  subrotulo?: string;
  /** `title` do rótulo, para o que não cabe na célula. */
  dica?: string;
  /**
   * `title` da CÉLULA do mês: decomposição do número, quando ele é soma de
   * parcelas de origens diferentes. Só entra quando a célula não tem override —
   * ali o title já explica o valor manual, que é a informação mais urgente.
   */
  dicaDoMes?: (m: MesFluxo) => string;
  valor: (m: MesFluxo) => number;
  /** Linhas calculadas não recebem override: elas são consequência, não entrada. */
  linha?: LinhaFluxo;
  destaque?: boolean;
  separador?: boolean;
  somavel?: boolean;
}

/** Ordem fixa da grade. Cada linha editável carrega seu `line_key` estável. */
const LINHAS: DefinicaoLinha[] = [
  { chave: 'land', rotulo: 'Terrenos', valor: (m) => m.land, linha: 'land' },
  { chave: 'construction', rotulo: 'Obra', valor: (m) => m.construction, linha: 'construction' },
  { chave: 'property_tax', rotulo: 'Property taxes', valor: (m) => m.propertyTax, linha: 'property_tax' },
  {
    chave: 'other_costs',
    rotulo: 'Custos',
    subrotulo: 'do orçamento',
    dica:
      'Custos adicionais lançados na aba Orçamento. Terrenos, Obra e Property taxes NÃO entram aqui — cada um tem linha própria acima. Expanda para ver por categoria e por descrição.',
    valor: (m) => m.otherCosts,
    linha: 'other_costs',
  },
  { chave: 'custo_fin', rotulo: 'Juros e taxas', valor: (m) => m.custoFinanceiroCaixa },
  { chave: 'pagamentos', rotulo: 'Total de pagamentos', valor: (m) => m.pagamentos, destaque: true },
  { chave: 'revenue', rotulo: 'Receita', valor: (m) => m.revenue, linha: 'revenue', separador: true },
  { chave: 'draw', rotulo: 'Saque', valor: (m) => m.draw, linha: 'draw' },
  {
    chave: 'amortization',
    rotulo: 'Amortização',
    // Decomposição do mês na dica: quanto saiu por release de unidade vendida e
    // quanto por quitação na saída. Os dois somam a amortização do mês, e sem
    // isso o degrau de um mês de venda parece vir do nada.
    dicaDoMes: (m) =>
      `Release: ${dinheiroCurto(m.amortizacaoRelease)} · Saída: ${dinheiroCurto(m.amortization - m.amortizacaoRelease)}`,
    valor: (m) => m.amortization,
    linha: 'amortization',
  },
  { chave: 'equity_call', rotulo: 'Aporte de equity', valor: (m) => m.equityCall, linha: 'equity_call', destaque: true },
  { chave: 'distribution', rotulo: 'Distribuição', valor: (m) => m.distribution, linha: 'distribution' },
  { chave: 'saldo', rotulo: 'Saldo devedor', valor: (m) => m.saldoDevedor, separador: true, somavel: false },
  // Linhas de LEITURA das migrations 1762100000 a 1762500000: explicam degraus
  // que, sem elas, pareceriam vir do nada. Nenhuma aceita override — são
  // consequência, não entrada. Com os defaults, todas ficam zeradas ou constantes.
  { chave: 'reserva_juros', rotulo: 'Saldo da reserva de juros', valor: (m) => m.saldoReservaJuros, somavel: false },
  { chave: 'unidades_vendidas', rotulo: 'Unidades vendidas no mês', valor: (m) => m.unidadesVendidas },
  { chave: 'taxa_efetiva', rotulo: 'Taxa efetiva (a.a.)', valor: (m) => m.taxaEfetivaAno, somavel: false },
  { chave: 'equity_ac', rotulo: 'Equity acumulado', valor: (m) => m.equityAcumulado, somavel: false },
  { chave: 'caixa_mes', rotulo: 'Caixa do mês', valor: (m) => m.caixaMes },
  { chave: 'caixa_ac', rotulo: 'Caixa acumulado', valor: (m) => m.caixaAcumulado, destaque: true, somavel: false },
];

const COL_ROTULO = 'sticky left-0 z-20 bg-white px-3 py-1.5 text-left text-sm';
const COL_TOTAL = 'sticky right-0 z-20 border-l border-slate-300 bg-slate-50 px-3 py-1.5 text-right text-sm tabular-nums';

/** As filhas de "Custos" são LEITURA: o override é por linha do fluxo, não por custo. */
const DICA_FILHA = 'Detalhamento. Para lançar valor manual, edite a linha "Custos".';

/**
 * Uma linha lançou alguma coisa quando algum MÊS é diferente de zero — e não
 * quando o total é diferente de zero.
 *
 * A distinção importa porque as linhas escondidas precisam valer exatamente zero
 * em todo mês: é isso que mantém pai = Σ filhas visíveis + ajuste manual. Um
 * total zero com meses que se cancelam é caso de laboratório, mas se aparecer,
 * aparece na tela em vez de sumir dela.
 */
const lancouAlgo = (porMes: number[]) => porMes.some((v) => v !== 0);

export function AbaFluxoCaixa({
  rascunho,
  resultado,
  resultadoAutomatico,
  aplicarOverride,
  reverterCelula,
  reverterLinha,
  reverterTudo,
}: Props) {
  const [editando, setEditando] = useState<{ mes: number; linha: LinhaFluxo } | null>(null);
  const [rascunhoTexto, setRascunhoTexto] = useState('');

  const overridePorChave = useMemo(() => {
    const mapa = new Map<string, boolean>();
    for (const o of rascunho.overrides ?? []) mapa.set(`${o.mes}:${o.linha}`, true);
    return mapa;
  }, [rascunho.overrides]);

  const temOverride = (mes: number, linha?: LinhaFluxo) =>
    !!linha && overridePorChave.has(`${mes}:${linha}`);

  const meses = resultado.meses;
  const manuais = resultado.celulasManuais;
  /** Com o plano ligado, editar a linha de aporte grava parcela, não override. */
  const planoLigado = rascunho.aportes?.modoAporte === 'plano';

  const confirmar = (mes: number, linha: LinhaFluxo) => {
    const valor = paraNumero(rascunhoTexto);
    if (valor !== null) aplicarOverride(mes, linha, valor);
    setEditando(null);
  };

  // ─── Detalhamento da linha "Custos" ────────────────────────────────────────
  // Estado SÓ de interface: não vai para o banco, não entra no ModelInput, não
  // aparece no diff de salvamento — mesma postura do acordeão da aba Orçamento.
  const idBase = useId();
  const [custosAberto, setCustosAberto] = useState(false);
  const [categoriasAbertas, setCategoriasAbertas] = useState<Set<CategoriaCusto>>(new Set());
  /** Categorias em que o usuário pediu para ver também os custos que não lançaram. */
  const [zeradosVisiveis, setZeradosVisiveis] = useState<Set<CategoriaCusto>>(new Set());

  const alternarNoConjunto = <T,>(
    definir: (f: (atual: Set<T>) => Set<T>) => void,
    chave: T,
  ) =>
    definir((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });

  // Uma implementação só do agrupamento, a mesma que o PDF e a planilha usam
  // quando forem detalhar: a tela não tem conta própria.
  const grupos = useMemo(
    () => agruparCustosPorCategoria(resultado.detalhamentoCustos ?? [], meses.length),
    [resultado.detalhamentoCustos, meses.length],
  );
  const gruposVisiveis = grupos.filter((g) => lancouAlgo(g.porMes));

  /**
   * O que o motor lançou em cada mês, somando TODAS as linhas — inclusive as que
   * a tela esconde (que valem zero, por construção de `lancouAlgo`).
   *
   * É o denominador do ajuste manual, e por isso soma o detalhamento inteiro em
   * vez de só o que está na tela: o pai tem de fechar com o que existe, não com
   * o que está aberto.
   */
  const automaticoPorMes = useMemo(
    () => meses.map((_, i) => grupos.reduce((a, g) => a + (g.porMes[i] ?? 0), 0)),
    [grupos, meses],
  );

  /**
   * Ajuste manual: o que o override forçou além do que o motor lançou.
   *
   * Zero em todo mês sem override — e a linha inteira só aparece quando existe
   * override de `other_costs` dentro do prazo. Sem ela, um mês com override
   * mostraria filhas que não somam o pai, e o detalhamento pareceria mentir.
   */
  const temOverrideCustos = meses.some((m) => temOverride(m.mes, 'other_costs'));
  const ajustePorMes = meses.map((m, i) => m.otherCosts - (automaticoPorMes[i] ?? 0));

  const idCategoria = (c: CategoriaCusto) => `${idBase}-custo-cat-${c}`;
  const idItem = (indice: number) => `${idBase}-custo-item-${indice}`;
  const idRodape = (c: CategoriaCusto) => `${idBase}-custo-rodape-${c}`;
  const idAjuste = `${idBase}-custo-ajuste`;

  /**
   * `aria-controls` do chevron de "Custos": todas as linhas de nível 1 que ele
   * abre. As linhas ficam SEMPRE no DOM, escondidas por `hidden` — assim os ids
   * referenciados existem também com a linha recolhida, que é o que torna o
   * atributo verdadeiro em vez de decorativo.
   */
  const controlesCustos = [
    ...gruposVisiveis.map((g) => idCategoria(g.categoria)),
    ...(temOverrideCustos ? [idAjuste] : []),
  ].join(' ');

  /** Renderiza uma linha filha do detalhamento — leitura pura, sem override. */
  const linhaDetalhe = (opts: {
    id: string;
    rotulo: React.ReactNode;
    valores: number[];
    oculta: boolean;
    /** 16px no nível 1, 32px no nível 2. */
    recuo: number;
    classeLinha: string;
    /** Fundo OPACO da coluna congelada: translucidez ali deixaria o texto vazar. */
    classeRotulo: string;
    classeValor: string;
    chevron?: { aberto: boolean; controla: string; alternar: () => void; nome: string };
  }) => (
    <tr key={opts.id} id={opts.id} hidden={opts.oculta} className={opts.classeLinha}>
      <td
        className={cn(COL_ROTULO, 'border-r border-slate-300 whitespace-nowrap', opts.classeRotulo)}
        style={{ paddingLeft: 12 + opts.recuo }}
        title={DICA_FILHA}
      >
        <span className="flex items-center gap-1.5">
          {opts.chevron ? (
            // <button> nativo já responde a Enter e Espaço; nenhum onKeyDown é
            // necessário, e adicionar um só criaria disparo duplo.
            <button
              type="button"
              onClick={opts.chevron.alternar}
              aria-expanded={opts.chevron.aberto}
              aria-controls={opts.chevron.controla}
              className="-ml-0.5 rounded p-0.5 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none',
                  opts.chevron.aberto && 'rotate-90',
                )}
              />
              <span className="sr-only">
                {opts.chevron.aberto ? 'Recolher' : 'Expandir'} {opts.chevron.nome}
              </span>
            </button>
          ) : null}
          {opts.rotulo}
        </span>
      </td>
      {meses.map((m, i) => (
        <td
          key={m.mes}
          title={DICA_FILHA}
          className={cn('border-b border-slate-100 px-2 py-1 text-right tabular-nums', opts.classeValor)}
        >
          {dinheiroCurto(opts.valores[i] ?? 0)}
        </td>
      ))}
      <td className={cn(COL_TOTAL, 'py-1 text-xs', opts.classeValor)}>
        {dinheiroCurto(opts.valores.reduce((a, b) => a + b, 0))}
      </td>
    </tr>
  );

  /** As descrições de uma categoria, mais o rodapé dos custos que não lançaram. */
  const linhasDaCategoria = (categoria: CategoriaCusto, itens: DetalheCusto[]) => {
    const categoriaAberta = categoriasAbertas.has(categoria);
    const oculta = !custosAberto || !categoriaAberta;
    const lancaram = itens.filter((d) => lancouAlgo(d.porMes));
    const zerados = itens.filter((d) => !lancouAlgo(d.porMes));
    const mostrandoZerados = zeradosVisiveis.has(categoria);
    const visiveis = mostrandoZerados ? [...lancaram, ...zerados] : lancaram;

    const rotuloItem = (d: DetalheCusto) =>
      d.label ? (
        <span>{d.label}</span>
      ) : (
        <span className="italic text-slate-400">Sem descrição</span>
      );

    return [
      ...visiveis.map((d) =>
        linhaDetalhe({
          id: idItem(d.indice),
          rotulo: rotuloItem(d),
          valores: d.porMes,
          oculta,
          recuo: 32,
          classeLinha: 'text-xs text-slate-500',
          classeRotulo: 'bg-white text-xs text-slate-500',
          classeValor: 'text-xs text-slate-500',
        }),
      ),
      zerados.length > 0 ? (
        <tr key={idRodape(categoria)} id={idRodape(categoria)} hidden={oculta}>
          <td
            className={cn(COL_ROTULO, 'border-r border-slate-300 whitespace-nowrap bg-white')}
            style={{ paddingLeft: 44 }}
          >
            <button
              type="button"
              onClick={() => alternarNoConjunto(setZeradosVisiveis, categoria)}
              aria-expanded={mostrandoZerados}
              className="rounded text-[11px] text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {mostrandoZerados
                ? `− ocultar ${zerados.length} sem lançamento no período`
                : `+${zerados.length} sem lançamento no período`}
            </button>
          </td>
          <td colSpan={meses.length + 1} className="border-b border-slate-100" />
        </tr>
      ) : null,
    ];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {manuais > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800">
              <Pencil className="h-3.5 w-3.5" />
              {manuais} {manuais === 1 ? 'célula em modo manual' : 'células em modo manual'}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              Nenhuma célula em modo manual — tudo automático.
            </span>
          )}
          {resultado.overridesOrfaos.length > 0 ? (
            <span className="rounded-full bg-slate-200 px-3 py-1.5 text-xs text-slate-700">
              +{resultado.overridesOrfaos.length} fora do prazo (guardados, inativos)
            </span>
          ) : null}
        </div>
        {manuais > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={reverterTudo}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reverter modelagem inteira
          </Button>
        ) : null}
      </div>

      <div className="relative max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(COL_ROTULO, 'sticky top-0 z-30 border-b border-r border-slate-300 font-semibold text-slate-700')}>
                Linha
              </th>
              {meses.map((m) => (
                <th
                  key={m.mes}
                  className="sticky top-0 z-10 min-w-[92px] border-b border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-semibold text-slate-600"
                >
                  <div>{m.mes}</div>
                  <div className="font-normal text-slate-400">{mesAno(m.data)}</div>
                </th>
              ))}
              <th className={cn(COL_TOTAL, 'top-0 z-30 border-b border-slate-300 text-xs font-semibold text-slate-700')}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((def) => {
              const total = def.somavel === false ? null : meses.reduce((a, m) => a + def.valor(m), 0);
              const linhaTemManual = def.linha ? meses.some((m) => temOverride(m.mes, def.linha)) : false;
              const expansivel = def.chave === 'other_costs';
              const principal = (
                <tr
                  className={cn(
                    def.separador && 'border-t-2 border-slate-300',
                    def.destaque ? 'bg-slate-100/70 font-semibold' : 'hover:bg-slate-50/60',
                  )}
                >
                  <td
                    className={cn(
                      COL_ROTULO,
                      'border-r border-slate-300 whitespace-nowrap',
                      def.destaque ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700',
                    )}
                    title={def.dica}
                  >
                    <span className="flex items-center gap-2">
                      {expansivel ? (
                        <button
                          type="button"
                          onClick={() => setCustosAberto((v) => !v)}
                          aria-expanded={custosAberto}
                          aria-controls={controlesCustos || undefined}
                          className="-ml-1 rounded p-0.5 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            className={cn(
                              'h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
                              custosAberto && 'rotate-90',
                            )}
                          />
                          <span className="sr-only">
                            {custosAberto ? 'Recolher' : 'Expandir'} o detalhamento dos custos
                          </span>
                        </button>
                      ) : null}
                      <span className="flex flex-col leading-tight">
                        {def.rotulo}
                        {def.subrotulo ? (
                          <span className="text-[11px] font-normal text-slate-400">{def.subrotulo}</span>
                        ) : null}
                      </span>
                      {linhaTemManual ? (
                        <button
                          type="button"
                          title={`Reverter a linha "${def.rotulo}" para automático`}
                          onClick={() => def.linha && reverterLinha(def.linha)}
                          className="text-amber-600 hover:text-amber-800"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </span>
                  </td>

                  {meses.map((m) => {
                    // Com cronograma por sócio a linha de aporte é consequência da
                    // aba Sócios: o valor do mês é a soma de aportes atribuídos a
                    // sócios nomeados, e um número digitado aqui não diria de quem
                    // é. A regra é a mesma que o motor usa — vem de
                    // lib/modelagem/aportes.ts, não repetida aqui.
                    const porSocio = !!def.linha && aporteSomenteLeitura(rascunho, def.linha);
                    const editavel = !!def.linha && !porSocio;
                    const marcado = temOverride(m.mes, def.linha);
                    const emEdicao =
                      editando && def.linha && editando.mes === m.mes && editando.linha === def.linha;
                    const automatico = def.valor(resultadoAutomatico.meses[m.mes - 1] ?? m);
                    const valor = def.valor(m);

                    if (emEdicao) {
                      return (
                        <td key={m.mes} className="border-b border-slate-100 p-0">
                          <input
                            autoFocus
                            className="h-8 w-full bg-amber-50 px-2 text-right text-sm tabular-nums outline-none ring-2 ring-amber-400"
                            value={rascunhoTexto}
                            onChange={(e) => setRascunhoTexto(e.target.value)}
                            onBlur={() => confirmar(m.mes, def.linha!)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmar(m.mes, def.linha!);
                              if (e.key === 'Escape') setEditando(null);
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={m.mes}
                        onClick={() => {
                          if (!editavel) return;
                          setRascunhoTexto(String(Number(valor.toFixed(2))));
                          setEditando({ mes: m.mes, linha: def.linha! });
                        }}
                        onDoubleClick={() => {
                          if (porSocio) return;
                          // Com o plano ligado a célula de aporte não tem override, mas
                          // tem parcela — e o duplo clique precisa dar conta dela também.
                          const reversivel = marcado || (planoLigado && def.linha === 'equity_call');
                          if (reversivel && def.linha) reverterCelula(m.mes, def.linha);
                        }}
                        title={
                          porSocio
                            ? AVISO_APORTE_POR_SOCIO
                            : marcado
                            ? `Manual. Valor automático: ${dinheiroCurto(automatico)}. Duplo clique reverte.`
                            : def.dicaDoMes
                              ? `${def.dicaDoMes(m)}${editavel ? ' · Clique para lançar um valor manual' : ''}`
                              : !editavel
                                ? 'Linha calculada — não recebe override'
                                : planoLigado && def.linha === 'equity_call'
                                  ? 'Editando aqui você altera a parcela do plano de aportes deste mês. Duplo clique remove a parcela.'
                                  : 'Clique para lançar um valor manual'
                        }
                        className={cn(
                          'relative border-b border-slate-100 px-2 py-1.5 text-right tabular-nums',
                          editavel && 'cursor-cell',
                          porSocio && 'cursor-not-allowed',
                          marcado && 'bg-amber-50 font-medium text-amber-900',
                          !marcado && valor < 0 && 'text-red-600',
                          !editavel && 'text-slate-500',
                        )}
                      >
                        {marcado ? (
                          <Pencil className="absolute left-1 top-1.5 h-2.5 w-2.5 text-amber-500" />
                        ) : null}
                        {dinheiroCurto(valor)}
                      </td>
                    );
                  })}

                  <td className={cn(COL_TOTAL, def.destaque && 'bg-slate-200 font-semibold text-slate-900')}>
                    {total === null ? '—' : dinheiroCurto(total)}
                  </td>
                </tr>
              );

              if (!expansivel) return <Fragment key={def.chave}>{principal}</Fragment>;

              return (
                <Fragment key={def.chave}>
                  {principal}
                  {gruposVisiveis.map((g) => (
                    <Fragment key={g.categoria}>
                      {linhaDetalhe({
                        id: idCategoria(g.categoria),
                        rotulo: <span>{ROTULO_CATEGORIA[g.categoria]}</span>,
                        valores: g.porMes,
                        oculta: !custosAberto,
                        recuo: 16,
                        classeLinha: 'bg-slate-50/40',
                        classeRotulo: 'bg-slate-50 text-[13px] text-slate-600',
                        classeValor: 'text-[13px] text-slate-600',
                        chevron: {
                          aberto: categoriasAbertas.has(g.categoria),
                          // As descrições e o rodapé desta categoria — todos no DOM,
                          // escondidos por `hidden` enquanto ela está recolhida.
                          controla: [
                            ...g.itens.map((d) => idItem(d.indice)),
                            idRodape(g.categoria),
                          ].join(' '),
                          alternar: () => alternarNoConjunto(setCategoriasAbertas, g.categoria),
                          nome: ROTULO_CATEGORIA[g.categoria],
                        },
                      })}
                      {linhasDaCategoria(g.categoria, g.itens)}
                    </Fragment>
                  ))}
                  {temOverrideCustos
                    ? linhaDetalhe({
                        id: idAjuste,
                        rotulo: <span>Ajuste manual</span>,
                        valores: ajustePorMes,
                        oculta: !custosAberto,
                        recuo: 16,
                        classeLinha: 'bg-amber-50/40',
                        classeRotulo: 'bg-amber-50 text-[13px] text-amber-700',
                        classeValor: 'text-[13px] text-amber-700',
                      })
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Clique numa célula editável para lançar um valor manual; duplo clique numa célula âmbar reverte
        para o automático. A linha <em>Custos</em> abre em categorias e descrições do orçamento — as
        filhas são leitura, e onde houver valor manual a diferença aparece como{' '}
        <em>Ajuste manual</em>, para que o pai sempre feche com a soma das filhas. As linhas{' '}
        <em>Total de pagamentos</em>, <em>Saldo devedor</em>, <em>Equity acumulado</em> e{' '}
        <em>Caixa</em> são calculadas e não recebem override — elas são consequência das demais.
        Colunas “Saldo devedor”, “Equity acumulado” e “Caixa acumulado” não somam na coluna de total
        porque são saldos, não fluxos.
      </p>
    </div>
  );
}
