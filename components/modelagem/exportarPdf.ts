/**
 * Relatório PDF da modelagem financeira.
 *
 * Tudo aqui lê o `ModelOutput` — nenhum número é recalculado. A única exceção
 * são as matrizes de sensibilidade, que por definição são rodadas novas do
 * motor: elas vêm de `lib/modelagem/sensibilidade`, não de conta feita aqui.
 */
import jsPDF from 'jspdf';
import {
  C,
  criarContexto,
  drawBadge,
  drawHeader,
  drawIndicatorCards,
  drawInfoBlock,
  drawRodape,
  drawSectionTitle,
  drawTabela,
  nomeSeguro,
  type CartaoIndicador,
  type ColunaTabela,
  type ContextoPdf,
  type LinhaTabela,
  type Tom,
} from '@/utils/pdf-theme';
import {
  gradeSensibilidade,
  pontosDeEquilibrio,
  sensibilidadePrazo,
  VARIACOES_CUSTO,
  VARIACOES_PRECO,
} from '@/lib/modelagem';
import type { LinhaFluxo, MesFluxo, ModelInput, ModelOutput, Semaforo } from '@/lib/modelagem';
import { dinheiro, dinheiroCurto, multiplo, numero, percentual } from './formato';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 'YYYY-MM-DD' → 'dez/2025'. Sem `new Date()`: evita deslocamento por fuso. */
function mesAnoLongo(dataIso: string | null | undefined): string {
  if (!dataIso) return '—';
  const [ano, mes] = String(dataIso).split('-').map(Number);
  if (!ano || !mes) return String(dataIso);
  return `${MESES_CURTOS[mes - 1]}/${ano}`;
}

/** Indicador ausente vira travessão no relatório — nunca NaN, nunca 0. */
const ouTraco = (texto: string) => (texto === 'n/d' ? '—' : texto);

const ROTULO_SAQUE: Record<string, string> = {
  equity_first: 'Equity primeiro',
  cash_demand: 'Demanda de caixa',
  manual: 'Manual',
};
const ROTULO_AMORTIZACAO: Record<string, string> = {
  at_exit: 'Integral na saída',
  manual: 'Manual',
};
const ROTULO_VENDA: Record<string, string> = {
  single_exit: 'Venda única na saída',
  per_unit: 'Por unidade',
  manual: 'Manual',
};
const ROTULO_APORTE: Record<string, string> = {
  demanda: 'Por demanda de caixa',
  plano: 'Plano de aportes',
};

/** Linhas do fluxo, na ordem exata de `AbaFluxoCaixa` (constante LINHAS). */
interface DefinicaoLinha {
  chave: string;
  rotulo: string;
  valor: (m: MesFluxo) => number;
  linha?: LinhaFluxo;
  destaque?: boolean;
  separador?: boolean;
  somavel?: boolean;
}

const LINHAS: DefinicaoLinha[] = [
  { chave: 'land', rotulo: 'Terrenos', valor: (m) => m.land, linha: 'land' },
  { chave: 'construction', rotulo: 'Obra', valor: (m) => m.construction, linha: 'construction' },
  { chave: 'property_tax', rotulo: 'Property taxes', valor: (m) => m.propertyTax, linha: 'property_tax' },
  { chave: 'other_costs', rotulo: 'Outros custos', valor: (m) => m.otherCosts, linha: 'other_costs' },
  { chave: 'custo_fin', rotulo: 'Juros e taxas', valor: (m) => m.custoFinanceiroCaixa },
  { chave: 'pagamentos', rotulo: 'Total de pagamentos', valor: (m) => m.pagamentos, destaque: true },
  { chave: 'revenue', rotulo: 'Receita', valor: (m) => m.revenue, linha: 'revenue', separador: true },
  { chave: 'draw', rotulo: 'Saque', valor: (m) => m.draw, linha: 'draw' },
  { chave: 'amortization', rotulo: 'Amortização', valor: (m) => m.amortization, linha: 'amortization' },
  { chave: 'equity_call', rotulo: 'Aporte de equity', valor: (m) => m.equityCall, linha: 'equity_call', destaque: true },
  { chave: 'distribution', rotulo: 'Distribuição', valor: (m) => m.distribution, linha: 'distribution' },
  { chave: 'saldo', rotulo: 'Saldo devedor', valor: (m) => m.saldoDevedor, separador: true, somavel: false },
  { chave: 'equity_ac', rotulo: 'Equity acumulado', valor: (m) => m.equityAcumulado, somavel: false },
  { chave: 'caixa_mes', rotulo: 'Caixa do mês', valor: (m) => m.caixaMes },
  { chave: 'caixa_ac', rotulo: 'Caixa acumulado', valor: (m) => m.caixaAcumulado, destaque: true, somavel: false },
];

const TOM_SEMAFORO: Record<Semaforo, Tom> = {
  verde: 'positive',
  ambar: 'accent',
  vermelho: 'negative',
};

/** Escala as larguras declaradas para preencher exatamente a largura útil. */
function distribuir(colunas: ColunaTabela[], alvo: number): ColunaTabela[] {
  const soma = colunas.reduce((a, c) => a + c.width, 0);
  if (soma <= 0) return colunas;
  const fator = alvo / soma;
  const ajustadas = colunas.map((c) => ({ ...c, width: c.width * fator }));
  // A sobra de arredondamento vai para a primeira coluna: a soma tem que fechar
  // com a largura útil, senão a régua da tabela não bate com a da seção.
  const total = ajustadas.reduce((a, c) => a + c.width, 0);
  ajustadas[0].width += alvo - total;
  return ajustadas;
}

/** Constrói o documento. Separado do download para poder ser inspecionado. */
export function construirPdfModelagem(input: ModelInput, resultado: ModelOutput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const ctx = criarContexto(doc);
  const moeda = input.moeda ?? 'USD';
  const d = (v: number | null | undefined) => dinheiro(v, moeda);
  const dc = (v: number | null | undefined) => dinheiroCurto(v);

  const emitidoEm = new Date();
  const emitidoLabel =
    emitidoEm.toLocaleDateString('pt-BR') +
    ' às ' +
    emitidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const { apuracao: ap, indicadores: ind, agregados: ag, cronograma: cr } = resultado;
  const nomeModelagem = input.nome || 'Modelagem sem nome';
  const usaFases = !!input.usaFases && (input.fases?.length ?? 0) > 0 && cr.fases.length > 0;
  const temQuantidade = input.unidades.some((u) => u.quantidade !== undefined && u.quantidade !== null);
  const plano = input.aportes;

  // ── 1 · Cabeçalho ─────────────────────────────────────────────────────────
  drawHeader(ctx, {
    titulo: 'Modelagem Financeira',
    subtitulo: nomeModelagem,
    badge: 'Modelagem',
    emitidoEm: emitidoLabel,
  });

  // ── 2 · Identificação ─────────────────────────────────────────────────────
  drawSectionTitle(ctx, 'Identificação', '', 'eyebrow');
  drawInfoBlock(ctx, [
    { label: 'Modelagem', value: nomeModelagem },
    { label: 'Localização', value: input.localizacao || '—' },
    { label: 'Tipo de uso', value: input.tipoUso || '—' },
    { label: 'Moeda', value: moeda },
    { label: 'Data do mês 1', value: `${mesAnoLongo(cr.dataInicio)} (${cr.dataInicio})` },
    { label: 'Emitido em', value: emitidoLabel },
  ]);

  // ── 3 · Sumário executivo ─────────────────────────────────────────────────
  drawSectionTitle(ctx, 'Sumário Executivo', '', 'eyebrow');
  const cards: CartaoIndicador[] = [
    { label: 'Total de pagamentos', value: d(ap.totalPagamentos), tone: 'default' },
    { label: 'Equity aportado', value: d(ap.equityTotal), tone: 'highlight' },
    { label: 'Dívida sacada', value: d(ap.dividaSacada), tone: 'default' },
    { label: 'VGV', value: d(ag.vgv), tone: 'default' },
    { label: 'Lucro do projeto', value: d(ap.lucroProjeto), tone: ap.lucroProjeto >= 0 ? 'positive' : 'negative' },
    { label: 'Lucro dos investidores', value: d(ap.lucroInvestidores), tone: 'positive' },
    { label: 'MOIC', value: ouTraco(multiplo(ind.moic)), tone: 'accent' },
    { label: 'TIR a.a.', value: ouTraco(percentual(ind.tirAnual)), tone: 'accent' },
    { label: 'Prazo até a saída', value: `${cr.mesSaida} meses`, tone: 'default' },
  ];
  drawIndicatorCards(ctx, cards, 3, { altura: 22, tamanhoValor: 10.5 });

  // ── 4 · Cronograma ────────────────────────────────────────────────────────
  drawSectionTitle(ctx, 'Cronograma', '', 'eyebrow');
  drawInfoBlock(ctx, [
    { label: 'Prazo total', value: `${cr.prazoTotal} meses` },
    { label: 'Início da obra', value: `mês ${cr.mesInicioObra} · ${mesAnoLongo(cr.dataInicioObra)}` },
    { label: 'Fim da obra', value: `mês ${cr.mesFimObra} · ${mesAnoLongo(cr.dataFimObra)}` },
    { label: 'Mês de saída', value: `mês ${cr.mesSaida} · ${mesAnoLongo(cr.dataSaida)}` },
    { label: 'Horizonte máximo', value: `${cr.horizonteMaximo} meses` },
    { label: 'Fases', value: usaFases ? `${cr.fases.length} fase(s)` : 'frente única' },
  ]);

  if (usaFases) {
    drawTabela(
      ctx,
      distribuir([
        { label: 'Fase', width: 50, align: 'left' },
        { label: 'Data início', width: 26, align: 'center' },
        { label: 'Data fim', width: 26, align: 'center' },
        { label: 'Mês início', width: 22, align: 'right' },
        { label: 'Mês fim', width: 22, align: 'right' },
        { label: 'Duração', width: 22, align: 'right' },
      ], ctx.contentWidth),
      cr.fases.map((f) => ({
        celulas: [
          f.nome || '—',
          f.dataInicio,
          f.dataFim,
          String(f.mesInicio),
          String(f.mesFim),
          `${f.mesFim - f.mesInicio + 1} m`,
        ],
      })),
      { tamanhoFonte: 7 },
    );
    ctx.y += 4;
  }

  // ── 5 · Premissas ─────────────────────────────────────────────────────────
  drawSectionTitle(ctx, 'Premissas', '', 'eyebrow');
  const fin = input.financiamento;
  const rec = input.receita;
  const tetoDivida = fin.valorContratado != null
    ? `${d(fin.valorContratado)} (contratado)`
    : fin.maxLtcPct != null
      ? `LTC de ${percentual(fin.maxLtcPct, 1)}`
      : 'sem teto declarado';

  const premissasFin: [string, string][] = [
    ['Taxa ao ano', percentual(fin.taxaAnual, 2)],
    ['Fee de estruturação', percentual(fin.feeEstruturacaoPct, 2)],
    ['Momento do fee', fin.feeTiming === 'first_draw' ? 'No primeiro saque' : `Mês ${fin.feeMes ?? '—'}`],
    ['Janela de saque', `mês ${fin.mesInicioSaque} a ${fin.mesFimSaque}`],
    ['Modo de saque', ROTULO_SAQUE[fin.modoSaque] ?? fin.modoSaque],
    ['Teto de dívida', tetoDivida],
    ['Modo de amortização', ROTULO_AMORTIZACAO[fin.modoAmortizacao] ?? fin.modoAmortizacao],
    ['Capitalização de juros', fin.capitalizarJuros ? 'Sim — juros somam ao saldo' : 'Não — juros pagos no mês'],
    ['Colchão mínimo de caixa', d(fin.colchaoMinimoCaixa)],
  ];
  const premissasRec: [string, string][] = [
    ['Comissão', percentual(rec.comissaoPct, 2)],
    ['Cartório / closing', percentual(rec.custoCartorioPct, 2)],
    ['Modo de venda', ROTULO_VENDA[rec.modoVenda] ?? rec.modoVenda],
    ['Mês de saída', `mês ${rec.mesSaida ?? cr.prazoTotal}`],
    ['Split investidores', percentual(rec.lucroInvestidoresPct, 2)],
    ['Split sponsor', percentual(rec.lucroSponsorPct, 2)],
  ];
  if (plano) premissasRec.push(['Modo de aporte', ROTULO_APORTE[plano.modoAporte] ?? plano.modoAporte]);

  const larguraMetade = (ctx.contentWidth - 6) / 2;
  const colsPar = (titulo: string) => distribuir([
    { label: titulo, width: 52, align: 'left' },
    { label: 'Valor', width: 36, align: 'right' },
  ], larguraMetade);
  const paraLinhas = (pares: [string, string][]): LinhaTabela[] =>
    pares.map(([k, v]) => ({ celulas: [k, v] }));

  const alturaPremissas = 8 + Math.max(premissasFin.length, premissasRec.length) * 7;
  ctx.ensureSpace(alturaPremissas + 4);
  const yPremissas = ctx.y;
  const yEsq = drawTabela(ctx, colsPar('Financiamento'), paraLinhas(premissasFin), {
    x: ctx.marginX, y: yPremissas, tamanhoFonte: 7,
  });
  const yDir = drawTabela(ctx, colsPar('Receita e saída'), paraLinhas(premissasRec), {
    x: ctx.marginX + larguraMetade + 6, y: yPremissas, tamanhoFonte: 7,
  });
  ctx.y = Math.max(yEsq, yDir) + 6;

  // ── 6 · Tipologias ────────────────────────────────────────────────────────
  drawSectionTitle(ctx, '', 'Tipologias', 'title');
  const colsTipologia: ColunaTabela[] = [
    { label: 'Nome', width: temQuantidade ? 26 : 34, align: 'left' },
    { label: 'Cidade', width: 16, align: 'left' },
    ...(temQuantidade ? [{ label: 'Qtd', width: 8, align: 'right' as const }] : []),
    { label: 'Área sf', width: 14, align: 'right' },
    { label: 'Terreno', width: 18, align: 'right' },
    { label: 'Obra', width: 18, align: 'right' },
    { label: 'Preço de venda', width: 19, align: 'right' },
    { label: 'Tax/ano', width: 13, align: 'right' },
    { label: 'Custo total', width: 19, align: 'right' },
    { label: 'Lucro', width: 19, align: 'right' },
    { label: 'Margem', width: 13, align: 'right' },
  ];
  // Os campos da tipologia são POR UNIDADE no input; aqui saem multiplicados
  // pela quantidade, para a linha de totais somar coisa que existe.
  const linhasTipologia: LinhaTabela[] = input.unidades.map((u, i) => {
    const r = resultado.resultadoUnidades[i];
    const qtd = Math.max(1, Math.trunc(u.quantidade || 1));
    const margem = r?.margem ?? null;
    return {
      celulas: [
        u.nome || `Tipologia ${i + 1}`,
        u.cidade || '—',
        ...(temQuantidade ? [String(qtd)] : []),
        u.areaSf ? numero((u.areaSf || 0) * qtd, 0) : '—',
        dc((u.custoTerreno || 0) * qtd),
        dc((u.custoObra || 0) * qtd),
        dc((u.precoVenda || 0) * qtd),
        dc((u.propertyTaxAno || 0) * qtd),
        dc(r?.custoTotal),
        { texto: dc(r?.lucro), cor: (r?.lucro ?? 0) < 0 ? C.rose : C.green, negrito: true },
        { texto: ouTraco(percentual(margem, 1)), cor: margem == null ? C.slate : margem < 0 ? C.rose : C.green },
      ],
    };
  });
  const somaLucro = resultado.resultadoUnidades.reduce((a, u) => a + u.lucro, 0);
  const somaReceitaLiquida = resultado.resultadoUnidades.reduce((a, u) => a + u.receitaLiquida, 0);
  const somaArea = input.unidades.reduce((a, u) => a + (u.areaSf || 0) * Math.max(1, Math.trunc(u.quantidade || 1)), 0);
  linhasTipologia.push({
    celulas: [
      `Totais (${input.unidades.length} tipologia(s))`,
      '',
      ...(temQuantidade ? [String(ag.unidadesTotal)] : []),
      somaArea ? numero(somaArea, 0) : '—',
      dc(ag.terrenosTotal),
      dc(ag.obraTotal),
      dc(ag.vgv),
      dc(ag.taxAnoTotal),
      dc(resultado.resultadoUnidades.reduce((a, u) => a + u.custoTotal, 0)),
      { texto: dc(somaLucro), cor: somaLucro < 0 ? C.rose : C.green },
      ouTraco(percentual(somaReceitaLiquida === 0 ? null : somaLucro / somaReceitaLiquida, 1)),
    ],
    fundo: C.light,
    negrito: true,
    reguaSuperior: true,
    cor: C.navy,
  });
  drawTabela(ctx, distribuir(colsTipologia, ctx.contentWidth), linhasTipologia, { tamanhoFonte: 6.5, tamanhoCabecalho: 6.5 });
  ctx.y += 2;
  ctx.st(C.slate);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  const notaTipologias = doc.splitTextToSize(
    'Área, terreno, obra, preço de venda e tax/ano são o TOTAL das unidades da tipologia. Custos que não pertencem a nenhuma tipologia são rateados pro-rata pelo custo direto. Margem = lucro ÷ receita líquida.',
    ctx.contentWidth,
  );
  doc.text(notaTipologias, ctx.marginX, ctx.y);
  ctx.y += notaTipologias.length * 3 + 5;

  // ── 7 · Usos e Fontes ─────────────────────────────────────────────────────
  drawSectionTitle(ctx, '', 'Usos e Fontes', 'title');
  const unidades = Math.max(1, ag.unidadesTotal || 1);
  const pctTotal = (v: number) => (ap.totalPagamentos === 0 ? '—' : percentual(v / ap.totalPagamentos, 1));
  const pagamentos: [string, number][] = [
    ['Terrenos', ap.custoTerrenos],
    ['Obra', ap.custoObra],
    ['Property taxes', ap.custoPropertyTax],
    ['Outros custos', ap.custoOutros],
    ['Juros e fees', ap.custoFinanceiro],
  ];
  const capitalTotal = ap.equityTotal + ap.dividaSacada;
  const pctCapital = (v: number) => (capitalTotal === 0 ? '—' : percentual(v / capitalTotal, 1));

  const colsPagamentos = distribuir([
    { label: 'Pagamentos do projeto', width: 32, align: 'left' },
    { label: 'Valor', width: 22, align: 'right' },
    { label: '% do total', width: 16, align: 'right' },
    { label: '$/unidade', width: 18, align: 'right' },
  ], larguraMetade);
  const linhasPagamentos: LinhaTabela[] = pagamentos.map(([k, v]) => ({
    celulas: [k, dc(v), pctTotal(v), dc(v / unidades)],
  }));
  linhasPagamentos.push({
    celulas: ['TOTAL DE PAGAMENTOS', dc(ap.totalPagamentos), '100,0%', dc(ap.totalPagamentos / unidades)],
    fundo: C.light, negrito: true, reguaSuperior: true, cor: C.navy,
  });

  const colsCapital = distribuir([
    { label: 'Capital', width: 40, align: 'left' },
    { label: 'Valor', width: 28, align: 'right' },
    { label: '% do total', width: 20, align: 'right' },
  ], larguraMetade);
  const diferenca = capitalTotal - ap.totalPagamentos;
  const linhasCapital: LinhaTabela[] = [
    { celulas: ['Equity aportado', dc(ap.equityTotal), pctCapital(ap.equityTotal)] },
    { celulas: ['Dívida sacada', dc(ap.dividaSacada), pctCapital(ap.dividaSacada)] },
    {
      celulas: ['TOTAL DE CAPITAL', dc(capitalTotal), '100,0%'],
      fundo: C.light, negrito: true, reguaSuperior: true, cor: C.navy,
    },
    {
      celulas: [
        'Capital − pagamentos',
        { texto: dc(diferenca), cor: diferenca < 0 ? C.rose : C.graphite },
        '',
      ],
    },
    {
      celulas: [{ texto: 'A diferença é coberta pela receita de vendas.', cor: C.slate, tamanho: 6.5 }],
      linhaLarga: true, fundo: C.white, altura: 6,
    },
  ];

  const alturaUsos = 8 + Math.max(linhasPagamentos.length, linhasCapital.length) * 7 + 4;
  ctx.ensureSpace(alturaUsos);
  const yUsos = ctx.y;
  const yPag = drawTabela(ctx, colsPagamentos, linhasPagamentos, { x: ctx.marginX, y: yUsos, tamanhoFonte: 7 });
  const yCap = drawTabela(ctx, colsCapital, linhasCapital, { x: ctx.marginX + larguraMetade + 6, y: yUsos, tamanhoFonte: 7 });
  ctx.y = Math.max(yPag, yCap) + 6;

  // ── 8 · Fluxo de caixa mensal (paisagem) ──────────────────────────────────
  desenharFluxo(ctx, input, resultado);

  // ── 9 · Cronograma de aportes ─────────────────────────────────────────────
  ctx.addPage('portrait');
  drawSectionTitle(ctx, '', 'Cronograma de Aportes', 'title');
  const parcelaPorMes = new Map<number, number>();
  for (const p of plano?.parcelas ?? []) parcelaPorMes.set(p.mes, (parcelaPorMes.get(p.mes) ?? 0) + (p.valor || 0));
  const temPlano = !!plano && (plano.parcelas?.length ?? 0) > 0;

  const colsAporte = distribuir([
    { label: 'Mês', width: 10, align: 'right' },
    { label: 'Data', width: 18, align: 'center' },
    ...(temPlano ? [{ label: 'Planejado', width: 24, align: 'right' as const }] : []),
    { label: 'Aporte do mês', width: 26, align: 'right' },
    ...(temPlano ? [{ label: 'Diferença', width: 22, align: 'right' as const }] : []),
    { label: '% do total', width: 18, align: 'right' },
    { label: 'Acumulado', width: 26, align: 'right' },
    { label: '% acumulado', width: 20, align: 'right' },
  ], ctx.contentWidth);

  const totalAportes = ap.equityTotal;
  const totalPlano = ag.aportePlanejadoTotal;
  const linhasAporte: LinhaTabela[] = [];
  for (const m of resultado.meses) {
    if (m.equityCall <= 0) continue;
    const planejado = parcelaPorMes.get(m.mes) ?? 0;
    const dif = m.equityCall - planejado;
    linhasAporte.push({
      celulas: [
        String(m.mes),
        mesAnoLongo(m.data),
        ...(temPlano ? [dc(planejado)] : []),
        dc(m.equityCall),
        ...(temPlano ? [{ texto: Math.abs(dif) < 0.005 ? '—' : dc(dif), cor: Math.abs(dif) < 0.005 ? C.slate : C.gold }] : []),
        totalAportes === 0 ? '—' : percentual(m.equityCall / totalAportes, 1),
        dc(m.equityAcumulado),
        totalAportes === 0 ? '—' : percentual(m.equityAcumulado / totalAportes, 1),
      ],
    });
  }
  if (linhasAporte.length === 0) {
    linhasAporte.push({
      celulas: [{ texto: 'Nenhum mês com chamada de capital.', cor: C.slate }],
      linhaLarga: true, fundo: C.white,
    });
  } else {
    linhasAporte.push({
      celulas: [
        'Total', '',
        ...(temPlano ? [dc(totalPlano)] : []),
        dc(totalAportes),
        ...(temPlano ? [dc(totalAportes - totalPlano)] : []),
        '100,0%', dc(totalAportes), '100,0%',
      ],
      fundo: C.light, negrito: true, reguaSuperior: true, cor: C.navy,
    });
  }
  drawTabela(ctx, colsAporte, linhasAporte, { tamanhoFonte: 7 });
  ctx.y += 6;

  // ── 10 · Apuração do resultado ────────────────────────────────────────────
  ctx.ensureSpace(40);
  drawSectionTitle(ctx, '', 'Apuração do Resultado', 'title');
  const colsDre = distribuir([
    { label: 'Item', width: 130, align: 'left' },
    { label: 'Valor', width: 52, align: 'right' },
  ], ctx.contentWidth);
  const dre: { rotulo: string; valor: number; negativo?: boolean; total?: boolean }[] = [
    { rotulo: 'Receita bruta (VGV)', valor: ap.receitaBruta },
    { rotulo: '(−) Comissões', valor: ap.comissoes, negativo: true },
    { rotulo: '(−) Cartório / closing', valor: ap.cartorio, negativo: true },
    { rotulo: '(=) Receita líquida', valor: ap.receitaLiquida, total: true },
    { rotulo: '(−) Terrenos', valor: ap.custoTerrenos, negativo: true },
    { rotulo: '(−) Obra', valor: ap.custoObra, negativo: true },
    { rotulo: '(−) Property taxes', valor: ap.custoPropertyTax, negativo: true },
    { rotulo: '(−) Outros custos', valor: ap.custoOutros, negativo: true },
    { rotulo: '(=) Custo do empreendimento', valor: ap.custoEmpreendimento, negativo: true, total: true },
    { rotulo: '(−) Juros', valor: ap.jurosTotais, negativo: true },
    { rotulo: '(−) Fee de estruturação', valor: ap.feeTotal, negativo: true },
    { rotulo: '(=) Custo financeiro', valor: ap.custoFinanceiro, negativo: true, total: true },
    { rotulo: '(=) LUCRO DO PROJETO', valor: ap.lucroProjeto, total: true },
    { rotulo: `Lucro dos investidores (${percentual(rec.lucroInvestidoresPct, 0)})`, valor: ap.lucroInvestidores },
    { rotulo: `Lucro do sponsor (${percentual(rec.lucroSponsorPct, 0)})`, valor: ap.lucroSponsor },
  ];
  drawTabela(
    ctx,
    colsDre,
    dre.map((l) => ({
      celulas: [
        l.rotulo,
        {
          texto: l.negativo ? `(${d(l.valor)})` : d(l.valor),
          cor: l.negativo || l.valor < 0 ? C.rose : C.navy,
          negrito: !!l.total,
        },
      ],
      fundo: l.total ? C.navySoft : undefined,
      negrito: l.total,
      cor: l.total ? C.navy : undefined,
    })),
    { tamanhoFonte: 7.5 },
  );
  ctx.y += 6;

  // ── 11 · Quadro de investidores ───────────────────────────────────────────
  ctx.ensureSpace(30);
  drawSectionTitle(ctx, '', 'Quadro de Investidores', 'title');
  const colsSocios = distribuir([
    { label: 'Sócio', width: 56, align: 'left' },
    { label: 'Participação', width: 24, align: 'right' },
    { label: 'Capital', width: 26, align: 'right' },
    { label: 'Lucro', width: 26, align: 'right' },
    { label: 'Total', width: 26, align: 'right' },
    { label: 'MOIC', width: 20, align: 'right' },
  ], ctx.contentWidth);
  const linhasSocios: LinhaTabela[] = resultado.rateioSocios.map((s, i) => ({
    celulas: [
      s.nome || `Sócio ${i + 1}`,
      percentual(s.participacaoPct, 2),
      dc(s.capital),
      dc(s.lucro),
      { texto: dc(s.total), negrito: true },
      ouTraco(multiplo(ind.moic)),
    ],
  }));
  if (resultado.rateioSocios.length > 0) {
    const somaCapital = resultado.rateioSocios.reduce((a, s) => a + s.capital, 0);
    const somaLucroSocios = resultado.rateioSocios.reduce((a, s) => a + s.lucro, 0);
    const somaTotal = resultado.rateioSocios.reduce((a, s) => a + s.total, 0);
    const somaPart = resultado.rateioSocios.reduce((a, s) => a + s.participacaoPct, 0);
    linhasSocios.push({
      celulas: ['Total', percentual(somaPart, 2), dc(somaCapital), dc(somaLucroSocios), dc(somaTotal), ''],
      fundo: C.light, negrito: true, reguaSuperior: true, cor: C.navy,
    });
  }
  const yAntesSocios = ctx.y;
  drawTabela(ctx, colsSocios, linhasSocios, { tamanhoFonte: 7 });
  // O badge de cota disponível é desenhado por cima: a informação de que aquele
  // capital ainda está por captar não pode se perder na exportação.
  resultado.rateioSocios.forEach((s, i) => {
    if (!s.cotaDisponivel) return;
    const yLinha = yAntesSocios + 8 + i * 7 + 1;
    if (yLinha + 5 > ctx.pageHeight - ctx.bottomReserve) return;
    const nome = s.nome || `Sócio ${i + 1}`;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    const largura = doc.getTextWidth(nome);
    drawBadge(ctx, ctx.marginX + 3 + largura + 3, yLinha, 'COTA DISPONÍVEL', 'accent', { tamanho: 5.5 });
  });
  ctx.y += 6;

  // ── 12 · Indicadores de retorno ───────────────────────────────────────────
  ctx.ensureSpace(40);
  drawSectionTitle(ctx, 'Indicadores de Retorno', '', 'eyebrow');
  drawIndicatorCards(ctx, [
    { label: 'MOIC', value: ouTraco(multiplo(ind.moic)), tone: 'accent' },
    { label: 'ROI', value: ouTraco(percentual(ind.roi)), tone: 'accent' },
    { label: 'Margem sobre VGV', value: ouTraco(percentual(ind.margemVgv)), tone: 'default' },
    { label: 'LTC', value: ouTraco(percentual(ind.ltc)), tone: 'default' },
    { label: 'Alavancagem', value: ouTraco(percentual(ind.alavancagem)), tone: 'default' },
    { label: 'Custo total da dívida', value: ouTraco(percentual(ind.custoTotalDividaPct)), tone: 'default' },
    { label: 'TIR mensal', value: ouTraco(percentual(ind.tirMensal, 4)), tone: 'accent' },
    { label: 'TIR anual', value: ouTraco(percentual(ind.tirAnual)), tone: 'accent' },
    { label: 'XIRR', value: ouTraco(percentual(ind.xirr)), tone: 'accent' },
  ], 3, { altura: 22, tamanhoValor: 10.5 });

  // ── 13 · Sensibilidade ────────────────────────────────────────────────────
  desenharSensibilidade(ctx, input, resultado);

  // ── 14 · Painel de validação ──────────────────────────────────────────────
  ctx.ensureSpace(40);
  drawSectionTitle(ctx, '', 'Painel de Validação', 'title');
  const colsConf = distribuir([
    { label: 'Conferência', width: 44, align: 'left' },
    { label: 'Semáforo', width: 20, align: 'center' },
    { label: 'Valor', width: 34, align: 'right' },
    { label: 'Detalhe', width: 84, align: 'left' },
  ], ctx.contentWidth);
  const linhasConf: LinhaTabela[] = [];
  for (const c of resultado.conferencias) {
    const tom = TOM_SEMAFORO[c.semaforo];
    const paleta = tom === 'positive'
      ? { bg: C.greenSoft, fg: C.green }
      : tom === 'accent'
        ? { bg: C.goldSoft, fg: C.gold }
        : { bg: C.roseSoft, fg: C.rose };
    linhasConf.push({
      celulas: [
        { texto: c.titulo, negrito: true, cor: C.navy },
        { texto: c.semaforo.toUpperCase(), cor: paleta.fg, negrito: true, fundo: paleta.bg },
        c.valor,
        c.detalhe,
      ],
    });
    if (c.semaforo !== 'verde' && c.comoResolver) {
      linhasConf.push({
        celulas: [{ texto: `Como resolver: ${c.comoResolver}`, cor: C.slate, tamanho: 7 }],
        linhaLarga: true, fundo: C.white,
      });
    }
  }
  drawTabela(ctx, colsConf, linhasConf, { tamanhoFonte: 7, quebrarTexto: true });
  ctx.y += 6;

  // ── 15 · Nota de rodapé da última página ──────────────────────────────────
  ctx.ensureSpace(14);
  ctx.st(C.slate);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text(
    doc.splitTextToSize(
      'Este material não constitui oferta de investimento. Os valores são projeções baseadas nas premissas informadas e não representam garantia de resultado.',
      ctx.contentWidth,
    ),
    ctx.marginX,
    ctx.y,
  );

  drawRodape(doc, emitidoLabel, ctx.marginX);
  return doc;
}

/** Seção 8: blocos de 12 meses em páginas paisagem. */
function desenharFluxo(ctx: ContextoPdf, input: ModelInput, resultado: ModelOutput) {
  const { doc } = ctx;
  const meses = resultado.meses;
  if (meses.length === 0) return;

  const overridePorChave = new Set<string>();
  for (const o of input.overrides ?? []) overridePorChave.add(`${o.mes}:${o.linha}`);

  const BLOCO = 12;
  for (let inicio = 0; inicio < meses.length; inicio += BLOCO) {
    const bloco = meses.slice(inicio, inicio + BLOCO);
    ctx.addPage('landscape');
    drawSectionTitle(
      ctx,
      '',
      `Fluxo de caixa · meses ${bloco[0].mes} a ${bloco[bloco.length - 1].mes}`,
      'title',
    );

    const colunas = distribuir([
      { label: 'Linha', width: 34, align: 'left' as const },
      ...bloco.map((m) => ({ label: `${m.mes}\n${mesAnoLongo(m.data)}`, width: 17, align: 'right' as const })),
      { label: 'Total', width: 19, align: 'right' as const },
    ], ctx.contentWidth);

    const linhas: LinhaTabela[] = LINHAS.map((def) => {
      // O total é o do período inteiro, como na tela — não o do bloco: quem lê a
      // página precisa do total da linha, não de um subtotal de 12 meses.
      const total = def.somavel === false ? null : meses.reduce((a, m) => a + def.valor(m), 0);
      return {
        celulas: [
          def.rotulo,
          ...bloco.map((m) => {
            const v = def.valor(m);
            const manual = !!def.linha && overridePorChave.has(`${m.mes}:${def.linha}`);
            return {
              texto: dinheiroCurto(v),
              cor: v < 0 ? C.rose : undefined,
              fundo: manual ? C.goldSoft : undefined,
              negrito: def.destaque,
            };
          }),
          { texto: total === null ? '—' : dinheiroCurto(total), negrito: true },
        ],
        fundo: def.destaque ? C.navySoft : undefined,
        negrito: def.destaque,
        cor: def.destaque ? C.navy : undefined,
        reguaSuperior: def.separador,
        altura: 6.5,
      };
    });

    drawTabela(ctx, colunas, linhas, { tamanhoFonte: 6.5, tamanhoCabecalho: 6, alturaCabecalho: 10 });

    ctx.y += 3;
    ctx.st(C.slate);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    const notas = [
      'Saldo devedor, Equity acumulado e Caixa acumulado são saldos, não fluxos — não somam na coluna Total.',
      resultado.celulasManuais > 0
        ? `${resultado.celulasManuais} célula(s) em modo manual — fundo âmbar.`
        : 'Nenhuma célula em modo manual — tudo automático.',
    ];
    doc.text(notas.join(' '), ctx.marginX, ctx.y);
    ctx.y += 4;
  }
}

/** Seção 13: as matrizes que `lib/modelagem/sensibilidade` produz. */
function desenharSensibilidade(ctx: ContextoPdf, input: ModelInput, resultado: ModelOutput) {
  const grade = gradeSensibilidade(input);
  const equilibrio = pontosDeEquilibrio(input);
  const atrasos = sensibilidadePrazo(input);
  const d = (v: number | null | undefined) => dinheiroCurto(v);

  ctx.addPage('portrait');
  drawSectionTitle(ctx, '', 'Sensibilidade', 'title');

  const colsGrade = distribuir([
    { label: 'Preço \\ Obra', width: 32, align: 'left' as const },
    ...VARIACOES_CUSTO.map((vc) => ({
      label: `${vc > 0 ? '+' : ''}${(vc * 100).toFixed(0)}%`,
      width: 30,
      align: 'right' as const,
    })),
  ], ctx.contentWidth);

  const matriz = (titulo: string, valor: (c: (typeof grade)[0][0]) => string, corrigirSinal: boolean) => {
    ctx.ensureSpace(12 + grade.length * 7);
    ctx.st(C.navy);
    ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9);
    ctx.doc.text(titulo, ctx.marginX, ctx.y);
    ctx.y += 4;
    drawTabela(
      ctx,
      colsGrade,
      grade.map((linha, i) => ({
        celulas: [
          { texto: `${VARIACOES_PRECO[i] > 0 ? '+' : ''}${(VARIACOES_PRECO[i] * 100).toFixed(0)}%`, negrito: true, cor: C.navy },
          ...linha.map((c) => ({
            texto: valor(c),
            cor: corrigirSinal ? (c.lucroProjeto < 0 ? C.rose : C.green) : C.graphite,
            fundo: c.variacaoPreco === 0 && c.variacaoCusto === 0 ? C.navySoft : undefined,
          })),
        ],
      })),
      { tamanhoFonte: 7 },
    );
    ctx.y += 5;
  };

  matriz('Lucro do projeto', (c) => d(c.lucroProjeto), true);
  matriz('MOIC', (c) => ouTraco(multiplo(c.moic)), false);

  ctx.ensureSpace(30);
  ctx.st(C.navy);
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9);
  ctx.doc.text('Pontos de equilíbrio', ctx.marginX, ctx.y);
  ctx.y += 4;
  drawTabela(
    ctx,
    distribuir([
      { label: 'Ponto de equilíbrio', width: 70, align: 'left' as const },
      { label: 'Valor', width: 56, align: 'right' as const },
      { label: 'Referência atual', width: 56, align: 'right' as const },
    ], ctx.contentWidth),
    [
      { celulas: ['VGV mínimo', equilibrio.vgvMinimo === null ? '—' : d(equilibrio.vgvMinimo), d(resultado.agregados.vgv)] },
      { celulas: ['Queda máxima no preço', ouTraco(percentual(equilibrio.quedaMaximaPreco, 1)), 'antes do prejuízo'] },
      { celulas: ['Custo de obra máximo', equilibrio.custoObraMaximo === null ? '—' : d(equilibrio.custoObraMaximo), d(resultado.agregados.obraTotal)] },
      { celulas: ['Alta máxima na obra', ouTraco(percentual(equilibrio.altaMaximaCusto, 1)), 'antes do prejuízo'] },
    ],
    { tamanhoFonte: 7 },
  );
  ctx.y += 5;

  ctx.ensureSpace(30);
  ctx.st(C.navy);
  ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9);
  ctx.doc.text('Sensibilidade ao prazo', ctx.marginX, ctx.y);
  ctx.y += 4;
  drawTabela(
    ctx,
    distribuir([
      { label: 'Atraso', width: 40, align: 'left' as const },
      { label: 'Prazo total', width: 30, align: 'right' as const },
      { label: 'Lucro do projeto', width: 42, align: 'right' as const },
      { label: 'MOIC', width: 34, align: 'right' as const },
      { label: 'TIR anual', width: 36, align: 'right' as const },
    ], ctx.contentWidth),
    atrasos.map((a) => ({
      celulas: [
        a.mesesAtraso === 0 ? 'Sem atraso (base)' : `+${a.mesesAtraso} meses`,
        `${a.prazoTotal} m`,
        { texto: d(a.lucroProjeto), cor: a.lucroProjeto < 0 ? C.rose : C.graphite },
        ouTraco(multiplo(a.moic)),
        ouTraco(percentual(a.tirAnual)),
      ],
      fundo: a.mesesAtraso === 0 ? C.light : undefined,
      negrito: a.mesesAtraso === 0,
    })),
    { tamanhoFonte: 7 },
  );
  ctx.y += 6;
}

export function nomeArquivoModelagem(input: ModelInput, extensao: string): string {
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return `${nomeSeguro(`modelagem_${input.nome || 'sem_nome'}_${data}`)}.${extensao}`;
}

export function exportarModelagemPdf(input: ModelInput, resultado: ModelOutput): void {
  const doc = construirPdfModelagem(input, resultado);
  doc.save(nomeArquivoModelagem(input, 'pdf'));
}
