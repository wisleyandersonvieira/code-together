/**
 * Relatório PDF para sócios e investidores.
 *
 * Irmão de `exportarPdf.ts`, com outro leitor: aquele é para quem audita o
 * modelo, este é para quem põe dinheiro. Mesma paleta, mesmas primitivas, e a
 * mesma regra dura — todo número sai do `ModelOutput`. As únicas contas que
 * rodam aqui são as do próprio motor, chamadas por `lib/modelagem/sensibilidade`.
 *
 * Enquadramento: o documento é um FLUXO. Nenhuma seção abre página por conta
 * própria; quem quebra é `ensureSpace`. As exceções são declaradas e são três —
 * a capa, o Anexo A e o Anexo B — mais as duas seções em paisagem, que trocam de
 * página por necessidade de orientação. Foi o `addPage` por seção que produzia
 * as páginas 70% vazias do relatório técnico.
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
  textoPdf,
  type CartaoIndicador,
  type ColunaTabela,
  type ContextoPdf,
  type LinhaTabela,
  type RgbColor,
} from '@/utils/pdf-theme';
import {
  agruparCustosPorCategoria,
  apuracaoAnual,
  gradeSensibilidade,
  LINHAS_ANUAL,
  pontosDeEquilibrio,
  ROTULO_CATEGORIA,
  sensibilidadePrazo,
  totalAnual,
  VARIACOES_CUSTO,
  VARIACOES_PRECO,
} from '@/lib/modelagem';
import type { MesFluxo, ModelInput, ModelOutput, RateioSocio } from '@/lib/modelagem';
import { dinheiro, dinheiroCurto, numero } from './formato';
import { distribuir, mesAnoLongo } from './exportarPdf';

// ─── Formatação ─────────────────────────────────────────────────────────────
// Dinheiro fica na convenção da moeda (USD escreve $1,234.00); percentual e
// múltiplo ficam na convenção do leitor, que é brasileiro. Misturar vírgula
// decimal em cifrão de dólar é que confundiria.

const finito = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

/** '20,4%'. Nulo, NaN e Infinity viram travessão — nunca vazam para a página. */
const pct = (v: number | null | undefined, casas = 1): string =>
  finito(v) ? `${(v * 100).toFixed(casas).replace('.', ',')}%` : '—';

/** '1,39x'. Mesma regra do travessão. */
const mult = (v: number | null | undefined): string =>
  finito(v) ? `${v.toFixed(2).replace('.', ',')}x` : '—';

/** '$1,2M' / '$918k' — só para eixo de gráfico, onde não cabe o número inteiro. */
function abreviado(v: number): string {
  const sinal = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sinal}$${(a / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (a >= 1_000) return `${sinal}$${Math.round(a / 1_000)}k`;
  return `${sinal}$${Math.round(a)}`;
}

/** '$0,78' — a moeda da frase "de cada $1,00". */
const centavos = (v: number) => `$${v.toFixed(2).replace('.', ',')}`;

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

// ─── Estado do documento ────────────────────────────────────────────────────

interface Secao {
  titulo: string;
  pagina: number;
}

/**
 * O contexto mais o que só se sabe no fim: em que página cada seção começou e
 * quanto de cada página foi de fato ocupado.
 *
 * O índice precisa da primeira; o rodapé, que diz o nome da seção, também. Por
 * isso o documento é montado inteiro ANTES de o índice ser desenhado, e a
 * página 1 é revisitada com `setPage`.
 */
interface Documento {
  ctx: ContextoPdf;
  doc: jsPDF;
  secoes: Secao[];
  /** Maior `y` alcançado em cada página. Só serve para auditar o enquadramento. */
  ocupacao: Map<number, number>;
  pagina: () => number;
  registrar: (titulo: string) => void;
}

function abrirDocumento(doc: jsPDF): Documento {
  const ctx = criarContexto(doc);
  const secoes: Secao[] = [];
  const ocupacao = new Map<number, number>();
  // Enquanto o documento é montado só se acrescenta página, então a corrente é
  // sempre a última. O `setPage` do índice acontece depois de tudo.
  const pagina = () => doc.getNumberOfPages();
  const marcar = () => ocupacao.set(pagina(), Math.max(ocupacao.get(pagina()) ?? 0, ctx.y));

  // `ensureSpace`, `drawTabela` e `drawIndicatorCards` chamam `ctx.addPage` pela
  // propriedade, então trocá-la aqui captura TODA quebra de página, inclusive as
  // que acontecem dentro de uma tabela longa.
  const addPageOriginal = ctx.addPage;
  ctx.addPage = (orientacao) => {
    marcar();
    addPageOriginal(orientacao);
  };

  return {
    ctx,
    doc,
    secoes,
    ocupacao,
    pagina,
    registrar: (titulo) => secoes.push({ titulo, pagina: pagina() }),
  };
}

/** Altura do título de seção mais três linhas de conteúdo. A regra do órfão. */
const RESERVA_ORFAO = 16 + 3 * 7;

/**
 * Abre uma seção do corpo. Nunca quebra página por conta própria: só garante
 * que o título não fique sozinho no pé — o defeito mais visível de um relatório
 * gerado é um cabeçalho de seção com o conteúdo na página seguinte.
 */
function secao(d: Documento, titulo: string, eyebrow = '') {
  // O título é desenhado com a base em `y`, então os glifos sobem acima dele:
  // sem este respiro ele encosta na tabela anterior.
  if (d.ctx.y > d.ctx.topStart + 1) d.ctx.y += 6;
  d.ctx.ensureSpace(RESERVA_ORFAO);
  d.registrar(titulo);
  drawSectionTitle(d.ctx, eyebrow, titulo, eyebrow ? 'both' : 'title');
}

/** Título de ANEXO: faixa navy cheia, para o leitor sentir a troca de registro. */
function anexo(d: Documento, letra: string, titulo: string, subtitulo: string) {
  const { ctx } = d;
  const { doc } = ctx;
  d.registrar(`Anexo ${letra} · ${titulo}`);
  const h = 18;
  ctx.sf(C.navy);
  doc.roundedRect(ctx.marginX, ctx.y, ctx.contentWidth, h, 3, 3, 'F');
  ctx.st(C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(textoPdf(`ANEXO ${letra}`), ctx.marginX + 5, ctx.y + 6.5);
  doc.setFontSize(13);
  doc.text(textoPdf(titulo), ctx.marginX + 5, ctx.y + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(textoPdf(subtitulo), ctx.marginX + ctx.contentWidth - 5, ctx.y + 13.5, { align: 'right' });
  ctx.y += h + 4;
}

/** Parágrafo corrido. Devolve a altura consumida. */
function paragrafo(ctx: ContextoPdf, texto: string, tamanho = 8, cor: RgbColor = C.graphite) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(tamanho);
  const linhas = doc.splitTextToSize(textoPdf(texto), ctx.contentWidth) as string[];
  ctx.ensureSpace(linhas.length * (tamanho * 0.42) + 3);
  ctx.st(cor);
  doc.text(linhas, ctx.marginX, ctx.y + tamanho * 0.32);
  ctx.y += linhas.length * (tamanho * 0.42) + 3;
}

/** Caixa com borda para a frase que o leitor precisa levar embora. */
function blocoDestaque(
  ctx: ContextoPdf,
  texto: string,
  cores: { fundo: RgbColor; borda: RgbColor; texto: RgbColor },
  tamanho = 10,
) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(tamanho);
  const linhas = doc.splitTextToSize(textoPdf(texto), ctx.contentWidth - 12) as string[];
  const h = linhas.length * (tamanho * 0.46) + 9;
  ctx.ensureSpace(h + 4);
  ctx.sf(cores.fundo);
  ctx.sd(cores.borda);
  doc.setLineWidth(0.5);
  doc.roundedRect(ctx.marginX, ctx.y, ctx.contentWidth, h, 3, 3, 'FD');
  ctx.st(cores.texto);
  doc.text(linhas, ctx.marginX + 6, ctx.y + 6.5);
  ctx.y += h + 5;
}

// ─── Documento ──────────────────────────────────────────────────────────────

/** Constrói o documento. Separado do download para poder ser inspecionado. */
export function construirPdfSocios(input: ModelInput, resultado: ModelOutput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const d = abrirDocumento(doc);
  const { ctx } = d;
  const moeda = input.moeda ?? 'USD';
  const din = (v: number | null | undefined) => dinheiro(v, moeda);
  const dc = (v: number | null | undefined) => dinheiroCurto(v);

  const agora = new Date();
  const emitidoLabel =
    agora.toLocaleDateString('pt-BR') +
    ' às ' +
    agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const nomeModelagem = input.nome || 'Modelagem sem nome';
  const equilibrio = pontosDeEquilibrio(input);

  desenharCapa(d, input, resultado, { emitidoLabel, nomeModelagem, equilibrio, agora, din, dc });

  // A capa é a primeira das três quebras deliberadas do documento.
  ctx.addPage('portrait');

  desenharIdentificacao(d, input, resultado, { nomeModelagem, moeda, agora });
  desenharAtivo(d, input, resultado, { dc });
  desenharUsosFontes(d, resultado, { dc, din });
  desenharGraficoCaixa(d, input, resultado);
  desenharCronograma(d, input, resultado, { agora, dc });
  desenharApuracao(d, input, resultado, { din });
  desenharInvestidores(d, input, resultado, { dc });
  desenharAnual(d, resultado);
  desenharSensibilidade(d, input, resultado, { dc, equilibrio });
  desenharAnexoFluxo(d, input, resultado);
  desenharAnexoSocios(d, resultado, { dc, din });

  // ── Fecho ────────────────────────────────────────────────────────────────
  ctx.ensureSpace(16);
  ctx.y += 2;
  ctx.st(C.slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    doc.splitTextToSize(
      textoPdf(
        'Este material não constitui oferta de investimento. Os valores são projeções baseadas nas premissas informadas e não representam garantia de resultado.',
      ),
      ctx.contentWidth,
    ),
    ctx.marginX,
    ctx.y,
  );
  ctx.y += 8;
  d.ocupacao.set(d.pagina(), Math.max(d.ocupacao.get(d.pagina()) ?? 0, ctx.y));

  // ── Índice ───────────────────────────────────────────────────────────────
  // Só agora as páginas são conhecidas. Se não couber no pé da página 1, ele
  // ganha uma página própria — e todo número já registrado anda uma casa.
  desenharIndice(d);

  // ── Rodapé ───────────────────────────────────────────────────────────────
  const porPagina = mapaDeSecoes(d);
  drawRodape(doc, emitidoLabel, ctx.marginX, {
    legenda: 'Relatório para Sócios',
    secaoDaPagina: (p) => porPagina.get(p),
  });

  return doc;
}

// ─── Página 1 · Capa e a oferta ─────────────────────────────────────────────

interface ContextoCapa {
  emitidoLabel: string;
  nomeModelagem: string;
  equilibrio: ReturnType<typeof pontosDeEquilibrio>;
  agora: Date;
  din: (v: number | null | undefined) => string;
  dc: (v: number | null | undefined) => string;
}

function desenharCapa(d: Documento, input: ModelInput, r: ModelOutput, c: ContextoCapa) {
  const { ctx } = d;
  const { apuracao: ap, indicadores: ind, agregados: ag, cronograma: cr } = r;
  d.registrar('Capa e oferta');

  drawHeader(ctx, {
    titulo: 'Relatório para Sócios',
    subtitulo: c.nomeModelagem,
    badge: 'Confidencial',
    emitidoEm: c.emitidoLabel,
    eyebrow: 'Modelagem Financeira',
  });

  // Quatro cartões grandes: o que entrou, o que volta, a que taxa e em quanto
  // tempo. É a operação inteira em quatro números.
  drawIndicatorCards(
    ctx,
    [
      { label: 'Capital chamado', value: c.din(ap.equityTotal), tone: 'highlight' },
      { label: 'Total a devolver aos investidores', value: c.din(ap.totalDistribuido), tone: 'positive' },
      { label: 'Múltiplo e retorno', value: `MOIC ${mult(ind.moic)} · TIR ${pct(ind.tirAnual)} a.a.`, tone: 'accent' },
      {
        label: 'Prazo até a devolução',
        value: `${plural(cr.mesSaida, 'mês', 'meses')} · ${mesAnoLongo(cr.dataSaida)}`,
        tone: 'default',
      },
    ],
    2,
    { altura: 27, tamanhoValor: 14 },
  );
  ctx.y += 2;

  // ── A linha de resistência ───────────────────────────────────────────────
  // Os dois números saem da bisseção de `pontosDeEquilibrio`, que roda o motor
  // de novo. Não são interpolação, e não são recalculados aqui.
  const queda = c.equilibrio.quedaMaximaPreco;
  const alta = c.equilibrio.altaMaximaCusto;
  const resistencia = finito(queda) && finito(alta)
    ? `Este projeto suporta uma queda de ${pct(queda)} no preço de venda ou uma alta de ${pct(alta)} no custo de obra antes de deixar de dar lucro.`
    : finito(queda)
      ? `Este projeto suporta uma queda de ${pct(queda)} no preço de venda antes de deixar de dar lucro. Não há alta de custo de obra que o leve ao prejuízo dentro do intervalo testado.`
      : finito(alta)
        ? `Este projeto suporta uma alta de ${pct(alta)} no custo de obra antes de deixar de dar lucro. Não há queda de preço que o leve ao prejuízo dentro do intervalo testado.`
        : 'O intervalo testado não encontrou ponto de equilíbrio para preço nem para custo de obra.';
  blocoDestaque(ctx, resistencia, { fundo: C.navySoft, borda: C.navy, texto: C.navy }, 10.5);

  // ── Contexto em uma linha ────────────────────────────────────────────────
  const cidades = [...new Set(input.unidades.map((u) => (u.cidade || '').trim()).filter(Boolean))];
  const local = input.localizacao || cidades.join(' e ') || '—';
  const contexto = [
    plural(ag.unidadesTotal, 'unidade', 'unidades'),
    local,
    `VGV $${c.dc(ag.vgv)}`,
    `início ${mesAnoLongo(cr.dataInicio)}`,
    `saída ${mesAnoLongo(cr.dataSaida)}`,
  ].join(' · ');
  paragrafo(ctx, contexto, 9, C.graphite);
  ctx.y += 1;

  // ── Cota em captação ─────────────────────────────────────────────────────
  // Só existe se algum sócio tem a flag. Sem ela o bloco não é renderizado —
  // um espaço vazio dizendo "nada disponível" seria pior que a ausência.
  const emCaptacao = r.rateioSocios.filter((s) => s.cotaDisponivel);
  if (emCaptacao.length > 0) {
    const capital = emCaptacao.reduce((a, s) => a + s.capital, 0);
    const fatia = emCaptacao.reduce((a, s) => a + s.pctCapital, 0);
    blocoDestaque(
      ctx,
      `$${c.dc(capital)} ainda disponíveis para captação — ${pct(fatia)} da operação.`,
      { fundo: C.goldSoft, borda: C.gold, texto: C.gold },
      10,
    );
  }

  // ── Validação em uma linha ───────────────────────────────────────────────
  const total = r.conferencias.length;
  const verdes = r.conferencias.filter((x) => x.semaforo === 'verde').length;
  const ambares = r.conferencias.filter((x) => x.semaforo === 'ambar').length;
  const vermelhos = r.conferencias.filter((x) => x.semaforo === 'vermelho').length;
  const partes = [`${verdes} aprovadas`];
  if (ambares > 0) partes.push(plural(ambares, 'alerta', 'alertas'));
  if (vermelhos > 0) partes.push(plural(vermelhos, 'pendência', 'pendências'));
  paragrafo(
    ctx,
    `Modelo submetido a ${total} conferências automáticas de consistência — ${partes.join(', ')}.`,
    8.5,
    C.slate,
  );
}

// ─── Índice ─────────────────────────────────────────────────────────────────

/** Altura de uma entrada do índice. Duas colunas, 8 pt. */
const LINHA_INDICE = 4.6;

function desenharIndice(d: Documento) {
  const { ctx, doc } = d;
  const entradas = d.secoes.filter((s) => s.titulo !== 'Capa e oferta');
  if (entradas.length === 0) return;

  const linhas = Math.ceil(entradas.length / 2);
  const altura = 6 + linhas * LINHA_INDICE + 2;

  // O pé da página 1 é o lugar certo: quem abre o documento vê o mapa antes de
  // virar a folha. Quando não cabe, o índice ganha a página 2 e TODA página já
  // registrada anda uma casa — inclusive as do rodapé, que é desenhado depois.
  const livreNaCapa = ctx.pageHeight - ctx.bottomReserve - (d.ocupacao.get(1) ?? ctx.pageHeight);
  const naCapa = altura + 6 <= livreNaCapa;

  if (naCapa) {
    doc.setPage(1);
  } else {
    doc.insertPage(2);
    for (const s of d.secoes) if (s.pagina >= 2) s.pagina += 1;
    const deslocada = new Map<number, number>();
    for (const [p, y] of d.ocupacao) deslocada.set(p >= 2 ? p + 1 : p, y);
    d.ocupacao = deslocada;
    doc.setPage(2);
  }

  const larguraPagina = doc.internal.pageSize.width;
  const alturaPagina = doc.internal.pageSize.height;
  const largura = larguraPagina - ctx.marginX * 2;
  // Ancorado no pé: é o rodapé do documento que ele acompanha, não o cursor.
  const topo = naCapa ? alturaPagina - ctx.bottomReserve - altura : ctx.topStart;

  ctx.sd(C.border);
  doc.setLineWidth(0.35);
  doc.line(ctx.marginX, topo, larguraPagina - ctx.marginX, topo);
  ctx.st(C.slate);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(textoPdf('NESTE RELATÓRIO'), ctx.marginX, topo + 4.5);

  const colLargura = (largura - 8) / 2;
  entradas.forEach((s, i) => {
    const coluna = Math.floor(i / linhas);
    const linha = i % linhas;
    const x = ctx.marginX + coluna * (colLargura + 8);
    const y = topo + 6 + (linha + 1) * LINHA_INDICE;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    ctx.st(C.graphite);
    const pagina = String(s.pagina);
    const larguraPag = doc.getTextWidth(pagina);
    const titulo = (doc.splitTextToSize(textoPdf(s.titulo), colLargura - larguraPag - 6) as string[])[0];
    doc.text(titulo, x, y);
    // Pontilhado entre o título e o número: é o que faz o olho não se perder.
    const inicioPontos = x + doc.getTextWidth(titulo) + 1.5;
    const fimPontos = x + colLargura - larguraPag - 1.5;
    if (fimPontos > inicioPontos) {
      ctx.sd(C.border);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([0.4, 1], 0);
      doc.line(inicioPontos, y - 0.8, fimPontos, y - 0.8);
      doc.setLineDashPattern([], 0);
    }
    ctx.st(C.navy);
    doc.setFont('helvetica', 'bold');
    doc.text(pagina, x + colLargura, y, { align: 'right' });
  });

  const ocupado = topo + altura;
  const paginaIndice = naCapa ? 1 : 2;
  d.ocupacao.set(paginaIndice, Math.max(d.ocupacao.get(paginaIndice) ?? 0, ocupado));
  if (!naCapa) d.secoes.push({ titulo: 'Índice', pagina: 2 });
}

/** Nome da seção de cada página, para o rodapé. Vale até a próxima começar. */
function mapaDeSecoes(d: Documento): Map<number, string> {
  const mapa = new Map<number, string>();
  const ordenadas = [...d.secoes].sort((a, b) => a.pagina - b.pagina);
  const total = d.doc.getNumberOfPages();
  let atual = ordenadas[0]?.titulo ?? '';
  let i = 0;
  for (let p = 1; p <= total; p++) {
    while (i < ordenadas.length && ordenadas[i].pagina <= p) atual = ordenadas[i++].titulo;
    mapa.set(p, atual);
  }
  return mapa;
}

// ─── Identificação e cronograma ─────────────────────────────────────────────

function desenharIdentificacao(
  d: Documento,
  input: ModelInput,
  r: ModelOutput,
  o: { nomeModelagem: string; moeda: string; agora: Date },
) {
  const { ctx } = d;
  const cr = r.cronograma;
  secao(d, 'Identificação e cronograma');

  // Sem isto o leitor não sabe se está vendo projeção ou histórico — foi uma
  // dúvida real na revisão do relatório anterior.
  const [anoIni, mesIni] = String(cr.dataInicio).split('-').map(Number);
  const decorridos =
    (o.agora.getFullYear() - (anoIni || 0)) * 12 + (o.agora.getMonth() + 1 - (mesIni || 0));
  const inicio = decorridos > 0
    ? `${mesAnoLongo(cr.dataInicio)} (projeto iniciado há ${plural(decorridos, 'mês', 'meses')})`
    : mesAnoLongo(cr.dataInicio);

  drawInfoBlock(ctx, [
    { label: 'Modelagem', value: o.nomeModelagem },
    { label: 'Localização', value: input.localizacao || '—' },
    { label: 'Tipo de uso', value: input.tipoUso || '—' },
    { label: 'Moeda', value: o.moeda },
    { label: 'Data de início do projeto', value: inicio },
    { label: 'Prazo total', value: plural(cr.prazoTotal, 'mês', 'meses') },
    { label: 'Início da obra', value: `mês ${cr.mesInicioObra} · ${mesAnoLongo(cr.dataInicioObra)}` },
    { label: 'Fim da obra', value: `mês ${cr.mesFimObra} · ${mesAnoLongo(cr.dataFimObra)}` },
    { label: 'Mês de saída', value: `mês ${cr.mesSaida} · ${mesAnoLongo(cr.dataSaida)}` },
  ]);
  ctx.y += 2;
}

// ─── O ativo ────────────────────────────────────────────────────────────────

function desenharAtivo(
  d: Documento,
  input: ModelInput,
  r: ModelOutput,
  o: { dc: (v: number | null | undefined) => string },
) {
  const { ctx } = d;
  const ag = r.agregados;
  secao(d, 'O ativo');

  // O preço POR UNIDADE é o número que se compara com o mercado, e até aqui ele
  // só existia numa nota de rodapé. O cabeçalho passa a dizer o que é unitário
  // ('/un.') e o que é total — a nota some porque virou coluna.
  const colunas: ColunaTabela[] = [
    { label: 'Nome', width: 26, align: 'left' },
    { label: 'Cidade', width: 17, align: 'left' },
    { label: 'Qtd', width: 8, align: 'right' },
    { label: 'Área/un.', width: 14, align: 'right' },
    { label: 'Preço/un.', width: 17, align: 'right' },
    { label: 'Custo/un.', width: 17, align: 'right' },
    { label: 'Margem/un.', width: 17, align: 'right' },
    { label: 'Preço total', width: 18, align: 'right' },
    { label: 'Custo total', width: 18, align: 'right' },
    { label: 'Lucro', width: 18, align: 'right' },
    { label: 'Margem', width: 13, align: 'right' },
  ];

  const linhas: LinhaTabela[] = input.unidades.map((u, i) => {
    const res = r.resultadoUnidades[i];
    const qtd = Math.max(1, Math.trunc(u.quantidade || 1));
    const margemUn = res ? res.lucro / Math.max(1, res.quantidade) : null;
    return {
      celulas: [
        u.nome || `Tipologia ${i + 1}`,
        u.cidade || '—',
        String(qtd),
        u.areaSf ? numero(u.areaSf, 0) : '—',
        o.dc(u.precoVenda),
        o.dc(res?.custoTotalUnitario),
        { texto: o.dc(margemUn), cor: (margemUn ?? 0) < 0 ? C.rose : C.green },
        o.dc((u.precoVenda || 0) * qtd),
        o.dc(res?.custoTotal),
        { texto: o.dc(res?.lucro), cor: (res?.lucro ?? 0) < 0 ? C.rose : C.green, negrito: true },
        {
          texto: pct(res?.margem),
          cor: !finito(res?.margem) ? C.slate : (res?.margem as number) < 0 ? C.rose : C.green,
        },
      ],
    };
  });

  const unidades = Math.max(1, ag.unidadesTotal || 1);
  const custoTotal = r.resultadoUnidades.reduce((a, u) => a + u.custoTotal, 0);
  const lucroTotal = r.resultadoUnidades.reduce((a, u) => a + u.lucro, 0);
  const receitaLiquida = r.resultadoUnidades.reduce((a, u) => a + u.receitaLiquida, 0);
  linhas.push({
    // Coluna total soma; coluna unitária é média PONDERADA pelas unidades —
    // média de médias daria outro número e não fecharia com o agregado.
    celulas: [
      `Totais (${plural(input.unidades.length, 'tipologia', 'tipologias')})`,
      '',
      String(ag.unidadesTotal),
      ag.areaTotalSf ? numero(ag.areaTotalSf / unidades, 0) : '—',
      o.dc(ag.vgv / unidades),
      o.dc(custoTotal / unidades),
      o.dc(lucroTotal / unidades),
      o.dc(ag.vgv),
      o.dc(custoTotal),
      { texto: o.dc(lucroTotal), cor: lucroTotal < 0 ? C.rose : C.green },
      pct(receitaLiquida === 0 ? null : lucroTotal / receitaLiquida),
    ],
    fundo: C.light,
    negrito: true,
    reguaSuperior: true,
    cor: C.navy,
  });

  drawTabela(ctx, distribuir(colunas, ctx.contentWidth), linhas, {
    tamanhoFonte: 6.5,
    tamanhoCabecalho: 6.5,
  });
  ctx.y += 4;
}

// ─── Usos e fontes ──────────────────────────────────────────────────────────

function desenharUsosFontes(
  d: Documento,
  r: ModelOutput,
  o: { dc: (v: number | null | undefined) => string; din: (v: number | null | undefined) => string },
) {
  const { ctx } = d;
  const { apuracao: ap, indicadores: ind, agregados: ag } = r;
  secao(d, 'Usos e fontes');

  // ── De cada $1,00 ────────────────────────────────────────────────────────
  // Percentuais derivados da apuração e arredondados a duas casas; a sobra do
  // arredondamento vai para a MAIOR parcela, para a frase fechar em $1,00.
  const partes = [
    { rotulo: 'a obra', valor: ap.custoObra },
    { rotulo: 'o terreno', valor: ap.custoTerrenos },
    { rotulo: 'juros e taxas', valor: ap.custoFinanceiro },
    { rotulo: 'outros custos', valor: ap.custoOutros },
    { rotulo: 'property taxes', valor: ap.custoPropertyTax },
  ]
    .filter((p) => p.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  if (ap.totalPagamentos > 0 && partes.length > 0) {
    const fatias = partes.map((p) => ({
      ...p,
      centavo: Math.round((p.valor / ap.totalPagamentos) * 100) / 100,
    }));
    const sobra = Math.round((1 - fatias.reduce((a, f) => a + f.centavo, 0)) * 100) / 100;
    fatias[0].centavo = Math.round((fatias[0].centavo + sobra) * 100) / 100;
    const frase = fatias
      .map((f, i) => `${centavos(f.centavo)} ${i === 0 ? 'vão para' : 'para'} ${f.rotulo}`)
      .join(', ');
    paragrafo(ctx, `De cada $1,00 aplicado no projeto: ${frase}.`, 9, C.navy);
    ctx.y += 1;
  }

  // ── As duas tabelas de sempre ────────────────────────────────────────────
  const larguraMetade = (ctx.contentWidth - 6) / 2;
  const unidades = Math.max(1, ag.unidadesTotal || 1);
  const pctPagamentos = (v: number) =>
    ap.totalPagamentos === 0 ? '—' : pct(v / ap.totalPagamentos);

  const linhasPagamentos: LinhaTabela[] = [
    ['Terrenos', ap.custoTerrenos],
    ['Obra', ap.custoObra],
    ['Property taxes', ap.custoPropertyTax],
    ['Outros custos', ap.custoOutros],
    ['Juros e fees', ap.custoFinanceiro],
  ].map(([k, v]) => ({
    celulas: [k as string, o.dc(v as number), pctPagamentos(v as number), o.dc((v as number) / unidades)],
  }));
  linhasPagamentos.push({
    celulas: [
      'TOTAL DE PAGAMENTOS',
      o.dc(ap.totalPagamentos),
      '100,0%',
      o.dc(ap.totalPagamentos / unidades),
    ],
    fundo: C.light,
    negrito: true,
    reguaSuperior: true,
    cor: C.navy,
  });

  const capitalTotal = ap.equityTotal + ap.dividaSacada;
  const pctCapital = (v: number) => (capitalTotal === 0 ? '—' : pct(v / capitalTotal));
  const diferenca = capitalTotal - ap.totalPagamentos;
  const linhasCapital: LinhaTabela[] = [
    { celulas: ['Capital dos sócios', o.dc(ap.equityTotal), pctCapital(ap.equityTotal)] },
    { celulas: ['Dívida sacada', o.dc(ap.dividaSacada), pctCapital(ap.dividaSacada)] },
    {
      celulas: ['TOTAL DE CAPITAL', o.dc(capitalTotal), '100,0%'],
      fundo: C.light,
      negrito: true,
      reguaSuperior: true,
      cor: C.navy,
    },
    {
      celulas: [
        'Capital - pagamentos',
        { texto: o.dc(diferenca), cor: diferenca < 0 ? C.rose : C.graphite },
        '',
      ],
    },
    {
      celulas: [{ texto: 'A diferença é coberta pela receita de vendas.', cor: C.slate, tamanho: 6.5 }],
      linhaLarga: true,
      fundo: C.white,
      altura: 6,
    },
  ];

  const altura = 8 + Math.max(linhasPagamentos.length, linhasCapital.length) * 7 + 4;
  ctx.ensureSpace(altura);
  const yTabelas = ctx.y;
  const yEsq = drawTabela(
    ctx,
    distribuir(
      [
        { label: 'Pagamentos do projeto', width: 32, align: 'left' },
        { label: 'Valor', width: 22, align: 'right' },
        { label: '% do total', width: 16, align: 'right' },
        { label: '$/unidade', width: 18, align: 'right' },
      ],
      larguraMetade,
    ),
    linhasPagamentos,
    { x: ctx.marginX, y: yTabelas, tamanhoFonte: 7 },
  );
  const yDir = drawTabela(
    ctx,
    distribuir(
      [
        { label: 'Capital', width: 40, align: 'left' },
        { label: 'Valor', width: 28, align: 'right' },
        { label: '% do total', width: 20, align: 'right' },
      ],
      larguraMetade,
    ),
    linhasCapital,
    { x: ctx.marginX + larguraMetade + 6, y: yTabelas, tamanhoFonte: 7 },
  );
  ctx.y = Math.max(yEsq, yDir) + 6;

  // ── Economia por unidade ─────────────────────────────────────────────────
  // É como se avalia um projeto residencial: o que custa e o que vale cada casa.
  ctx.ensureSpace(28);
  ctx.st(C.slate);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.text(textoPdf('ECONOMIA POR UNIDADE'), ctx.marginX, ctx.y);
  ctx.y += 4;
  const cartoes: CartaoIndicador[] = [
    { label: 'Custo total por unidade', value: finito(ind.custoPorUnidade) ? o.din(ind.custoPorUnidade) : '—' },
    {
      label: 'Preço médio por unidade',
      value: finito(ind.precoMedioPorUnidade) ? o.din(ind.precoMedioPorUnidade) : '—',
      tone: 'highlight',
    },
    {
      label: 'Margem por unidade',
      value: finito(ind.margemPorUnidade) ? o.din(ind.margemPorUnidade) : '—',
      tone: (ind.margemPorUnidade ?? 0) < 0 ? 'negative' : 'positive',
    },
  ];
  drawIndicatorCards(ctx, cartoes, 3, { altura: 20, tamanhoValor: 11 });
  ctx.y += 2;
}

// ─── O caixa em gráfico ─────────────────────────────────────────────────────

/** Altura total do bloco do gráfico, em mm. */
const ALTURA_GRAFICO = 90;

function desenharGraficoCaixa(d: Documento, input: ModelInput, r: ModelOutput) {
  const { ctx } = d;
  const { doc } = ctx;
  const meses = r.meses;
  if (meses.length === 0) return;

  secao(d, 'O caixa em gráfico');
  ctx.ensureSpace(ALTURA_GRAFICO + 18);

  // ── As três séries ───────────────────────────────────────────────────────
  const caixa = meses.map((m) => m.caixaAcumulado);
  const divida = meses.map((m) => m.saldoDevedor);
  // Capital em risco: o que os sócios puseram menos o que já voltou, acumulado.
  // Exato, e só usa campos que já existem em `rateioSocios`.
  const risco: number[] = [];
  let acumulado = 0;
  for (let i = 0; i < meses.length; i++) {
    for (const s of r.rateioSocios) {
      acumulado += (s.chamadasPorMes[i] || 0) - (s.devolucoesPorMes[i] || 0);
    }
    risco.push(acumulado);
  }

  const colchao = input.financiamento.colchaoMinimoCaixa || 0;
  const series = [
    { nome: 'Caixa acumulado', valores: caixa, cor: C.blue, area: C.blueSoft },
    { nome: 'Saldo devedor', valores: divida, cor: C.rose, area: null },
    { nome: 'Capital em risco', valores: risco, cor: C.navy, area: null },
  ];

  const todos = [...caixa, ...divida, ...risco, 0, colchao];
  const bruto = { min: Math.min(...todos), max: Math.max(...todos) };
  const folga = (bruto.max - bruto.min) * 0.08 || 1;
  const vMin = bruto.min - folga;
  const vMax = bruto.max + folga;

  // ── Geometria ────────────────────────────────────────────────────────────
  const ROTULO_Y = 20;
  const ALTURA_LEGENDA = 6;
  const ALTURA_EIXO_X = 7;
  const x0 = ctx.marginX + ROTULO_Y;
  const largura = ctx.contentWidth - ROTULO_Y;
  const topo = ctx.y + ALTURA_LEGENDA;
  const alturaPlot = ALTURA_GRAFICO - ALTURA_LEGENDA - ALTURA_EIXO_X;
  const base = topo + alturaPlot;
  const n = meses.length;
  const px = (mes: number) => x0 + (n === 1 ? largura / 2 : ((mes - 1) / (n - 1)) * largura);
  const py = (v: number) => base - ((v - vMin) / (vMax - vMin)) * alturaPlot;

  // ── Legenda ──────────────────────────────────────────────────────────────
  let lx = x0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  for (const s of series) {
    ctx.sf(s.cor);
    doc.rect(lx, ctx.y + 1.4, 3, 1.6, 'F');
    ctx.st(C.graphite);
    doc.text(textoPdf(s.nome), lx + 4.4, ctx.y + 3);
    lx += doc.getTextWidth(textoPdf(s.nome)) + 12;
  }

  // ── Grade e eixo Y ───────────────────────────────────────────────────────
  ctx.sd(C.border);
  doc.setLineWidth(0.2);
  doc.setFontSize(6);
  for (let i = 0; i <= 4; i++) {
    const v = vMin + ((vMax - vMin) * i) / 4;
    const y = py(v);
    doc.line(x0, y, x0 + largura, y);
    ctx.st(C.slate);
    doc.text(textoPdf(abreviado(v)), x0 - 2, y + 1, { align: 'right' });
  }

  // Zero e colchão mínimo: as duas referências que dizem se o caixa está bem.
  if (0 >= vMin && 0 <= vMax) {
    ctx.sd(C.border);
    doc.setLineWidth(0.5);
    doc.line(x0, py(0), x0 + largura, py(0));
  }
  // ── Séries ───────────────────────────────────────────────────────────────
  for (const s of series) {
    const pontos = s.valores.map((v, i) => ({ x: px(i + 1), y: py(v) }));
    if (s.area && pontos.length > 1) {
      const yBase = Math.min(base, Math.max(topo, py(Math.max(vMin, Math.min(0, vMax)))));
      const deltas: [number, number][] = [];
      for (let i = 1; i < pontos.length; i++) {
        deltas.push([pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y]);
      }
      deltas.push([0, yBase - pontos[pontos.length - 1].y]);
      deltas.push([pontos[0].x - pontos[pontos.length - 1].x, 0]);
      ctx.sf(s.area);
      doc.lines(deltas, pontos[0].x, pontos[0].y, [1, 1], 'F', true);
    }
    ctx.sd(s.cor);
    doc.setLineWidth(0.7);
    for (let i = 1; i < pontos.length; i++) {
      doc.line(pontos[i - 1].x, pontos[i - 1].y, pontos[i].x, pontos[i].y);
    }
  }

  // O colchão vai por CIMA das séries: desenhado antes, ele sumia debaixo da
  // curva do saldo devedor justamente nos meses em que o caixa chega perto dele
  // — que são os únicos meses em que a referência importa.
  if (colchao > 0) {
    ctx.sd(C.gold);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(x0, py(colchao), x0 + largura, py(colchao));
    doc.setLineDashPattern([], 0);
    ctx.st(C.gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(textoPdf(`colchão mínimo ${abreviado(colchao)}`), x0 + largura, py(colchao) - 1.6, {
      align: 'right',
    });
  }

  // ── Eixo X ───────────────────────────────────────────────────────────────
  ctx.sd(C.border);
  doc.setLineWidth(0.3);
  doc.line(x0, base, x0 + largura, base);
  doc.setFontSize(5.5);
  ctx.st(C.slate);
  for (let m = 1; m <= n; m += 3) {
    doc.text(textoPdf(rotuloMesCurto(meses[m - 1])), px(m), base + 4, { align: 'center' });
  }

  // ── Marcadores ───────────────────────────────────────────────────────────
  // O mínimo do caixa é o MESMO número da conferência `caixa_minimo`, e o pico
  // da dívida é o MESMO `apuracao.saldoDevedorMaximo`. Duas leituras, uma fonte.
  const iCaixa = caixa.indexOf(Math.min(...caixa));
  const iDivida = divida.indexOf(Math.max(...divida));
  const marcar = (i: number, valor: number, cor: RgbColor, rotulo: string, acima: boolean) => {
    const x = px(i + 1);
    const y = py(valor);
    ctx.sf(cor);
    doc.circle(x, y, 1.1, 'F');
    ctx.st(cor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    const texto = `${rotulo} ${abreviado(valor)} · mês ${meses[i].mes}`;
    const larguraTexto = doc.getTextWidth(textoPdf(texto));
    const alinhado = x + larguraTexto / 2 > x0 + largura ? 'right' : 'center';
    doc.text(textoPdf(texto), alinhado === 'right' ? x0 + largura : x, acima ? y - 2.6 : y + 4, {
      align: alinhado,
    });
  };
  marcar(iCaixa, caixa[iCaixa], C.blue, 'caixa mínimo', false);
  marcar(iDivida, divida[iDivida], C.rose, 'pico da dívida', true);

  ctx.y = base + ALTURA_EIXO_X + 3;

  // ── Três frases lendo o gráfico ──────────────────────────────────────────
  const primeiroAporte = meses.find((m) => m.equityCall > 0.005);
  const minimoCaixa = caixa[iCaixa];
  const frases = [
    `Capital exposto de ${mesAnoLongo((primeiroAporte ?? meses[0]).data)} a ${mesAnoLongo(r.cronograma.dataSaida)}`,
    `dívida no pico $${dinheiroCurto(r.apuracao.saldoDevedorMaximo)} no mês ${meses[iDivida].mes}`,
    colchao > 0
      ? minimoCaixa >= colchao - 0.005
        ? `o caixa nunca fura o colchão de $${dinheiroCurto(colchao)}`
        : `o caixa fura o colchão de $${dinheiroCurto(colchao)} no mês ${meses[iCaixa].mes}, chegando a $${dinheiroCurto(minimoCaixa)}`
      : minimoCaixa >= -0.005
        ? 'o caixa nunca fica negativo'
        : `o caixa fica negativo no mês ${meses[iCaixa].mes}, chegando a $${dinheiroCurto(minimoCaixa)}`,
  ];
  paragrafo(ctx, frases.join(' · '), 8, C.graphite);
  ctx.y += 2;
}

/** 'jan/26' para a régua do gráfico, onde não cabe o ano inteiro. */
function rotuloMesCurto(m: MesFluxo): string {
  const longo = mesAnoLongo(m.data);
  return longo.replace(/\/(\d\d)(\d\d)$/, '/$2');
}

// ─── Cronograma e marcos (paisagem) ─────────────────────────────────────────

const CORES_FASE: RgbColor[] = [C.navy, C.green, C.gold, C.blue, C.rose];

function desenharCronograma(
  d: Documento,
  input: ModelInput,
  r: ModelOutput,
  o: { agora: Date; dc: (v: number | null | undefined) => string },
) {
  const { ctx } = d;
  const { doc } = ctx;
  const cr = r.cronograma;
  const prazo = cr.prazoTotal;
  if (prazo <= 0) return;

  // Paisagem: a régua de 26 meses não cabe em retrato sem virar tira ilegível.
  // É quebra por ORIENTAÇÃO, não por seção — e é esperada.
  ctx.addPage('landscape');
  secao(d, 'Cronograma e marcos');

  const ROTULO = 42;
  const x0 = ctx.marginX + ROTULO;
  const largura = ctx.contentWidth - ROTULO;
  const limitar = (m: number) => Math.max(1, Math.min(Math.trunc(m), prazo));
  const xDe = (mes: number) => x0 + ((limitar(mes) - 1) / prazo) * largura;
  const larguraDe = (de: number, ate: number) => {
    const i = limitar(de);
    const f = Math.max(i, limitar(Math.max(ate, de)));
    return ((f - i + 1) / prazo) * largura;
  };
  const xPonto = (mes: number) => xDe(mes) + largura / prazo / 2;

  // ── Régua ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  ctx.st(C.slate);
  for (let m = 1; m <= prazo; m += 3) {
    const rotulo = r.meses[m - 1] ? mesAnoLongo(r.meses[m - 1].data) : String(m);
    doc.text(textoPdf(`${m} · ${rotulo}`), xPonto(m), ctx.y, { align: 'center' });
  }
  ctx.y += 2;
  ctx.sd(C.border);
  doc.setLineWidth(0.25);
  doc.line(x0, ctx.y, x0 + largura, ctx.y);
  ctx.y += 4;
  const topoTrilhas = ctx.y;

  const ALTURA_TRILHA = 13;
  const trilha = (rotulo: string, desenhar: (topo: number) => void) => {
    ctx.ensureSpace(ALTURA_TRILHA + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    ctx.st(C.graphite);
    doc.text(textoPdf(rotulo), ctx.marginX, ctx.y + ALTURA_TRILHA / 2 + 1, { maxWidth: ROTULO - 3 });
    ctx.sf(C.light);
    doc.rect(x0, ctx.y, largura, ALTURA_TRILHA, 'F');
    desenhar(ctx.y);
    ctx.y += ALTURA_TRILHA + 5;
  };

  const barra = (rotulo: string, de: number, ate: number, cor: RgbColor) =>
    trilha(rotulo, (topo) => {
      ctx.sf(cor);
      doc.rect(xDe(de), topo, larguraDe(de, ate), ALTURA_TRILHA, 'F');
    });

  if (input.mesesAprovacao > 0) barra('Aprovação', 1, cr.mesInicioObra - 1, C.slate);
  if (input.mesesConstrucao > 0) barra('Obra', cr.mesInicioObra, cr.mesFimObra, C.navy);
  if (input.mesesPosObra > 0) barra('Pós-obra', cr.mesFimObra + 1, prazo, C.border);

  if (input.usaFases && cr.fases.length > 0) {
    cr.fases.forEach((f, i) => {
      barra(f.nome || `Fase ${i + 1}`, f.mesInicio, f.mesFim, CORES_FASE[i % CORES_FASE.length]);
    });
  }

  // ── Vendas ───────────────────────────────────────────────────────────────
  const vendas = new Map<number, { unidades: number; valor: number }>();
  if (input.receita.modoVenda === 'takedown') {
    for (const t of input.receita.takedowns ?? []) {
      const u = input.unidades[t.unidadeIndex];
      if (!u || t.mes < 1 || t.mes > prazo) continue;
      const qtd = Math.max(0, Math.trunc(t.quantidade || 0));
      const preco = t.precoUnitario > 0 ? t.precoUnitario : u.precoVenda || 0;
      const atual = vendas.get(t.mes) ?? { unidades: 0, valor: 0 };
      vendas.set(t.mes, { unidades: atual.unidades + qtd, valor: atual.valor + qtd * preco });
    }
  }
  if (vendas.size > 0) {
    ctx.y += 3;
    trilha('Vendas', (topo) => {
      for (const [mes, v] of [...vendas.entries()].sort((a, b) => a[0] - b[0])) {
        ctx.sf(C.green);
        doc.rect(xPonto(mes) - 0.5, topo, 1, ALTURA_TRILHA, 'F');
        ctx.st(C.green);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.text(
          textoPdf(`${v.unidades} un · $${o.dc(v.valor)}`),
          xPonto(mes),
          topo - 1.2,
          { align: 'center' },
        );
      }
    });
  }

  // ── Financiamento ────────────────────────────────────────────────────────
  const marcos = [
    { mes: input.financiamento.mesInicioSaque, rotulo: 'Início do saque', cor: C.green },
    { mes: input.financiamento.mesFimSaque, rotulo: 'Fim do saque', cor: C.gold },
    { mes: cr.mesSaida, rotulo: 'Saída', cor: C.rose },
  ].filter((x) => x.mes >= 1 && x.mes <= prazo);
  if (marcos.length > 0) {
    trilha('Financiamento', (topo) => {
      const inicio = input.financiamento.mesInicioSaque;
      const fim = input.financiamento.mesFimSaque;
      if (fim >= inicio) {
        ctx.sf(C.navySoft);
        doc.rect(xDe(inicio), topo, larguraDe(inicio, fim), ALTURA_TRILHA, 'F');
      }
      for (const x of marcos) {
        ctx.sf(x.cor);
        doc.rect(xPonto(x.mes) - 0.5, topo, 1, ALTURA_TRILHA, 'F');
      }
    });
  }

  // ── Hoje ─────────────────────────────────────────────────────────────────
  // Só quando a emissão cai dentro do prazo: uma linha de "hoje" fora da régua
  // seria uma linha mentindo sobre onde o projeto está.
  const hoje = `${o.agora.getFullYear()}-${String(o.agora.getMonth() + 1).padStart(2, '0')}`;
  const iHoje = r.meses.findIndex((m) => String(m.data).slice(0, 7) === hoje);
  if (iHoje >= 0) {
    const x = xPonto(iHoje + 1);
    ctx.sd(C.rose);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([1.5, 1], 0);
    doc.line(x, topoTrilhas - 2, x, ctx.y - 5);
    doc.setLineDashPattern([], 0);
    ctx.st(C.rose);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(textoPdf('HOJE'), x, topoTrilhas - 3, { align: 'center' });
  }

  // ── Legenda ──────────────────────────────────────────────────────────────
  ctx.y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  let lx = ctx.marginX + ROTULO;
  const legenda = [
    ...(input.mesesAprovacao > 0 ? [{ cor: C.slate, texto: 'Aprovação' }] : []),
    ...(input.mesesConstrucao > 0 ? [{ cor: C.navy, texto: 'Obra' }] : []),
    ...(input.mesesPosObra > 0 ? [{ cor: C.border, texto: 'Pós-obra' }] : []),
    ...(vendas.size > 0 ? [{ cor: C.green, texto: 'Venda (takedown)' }] : []),
    { cor: C.navySoft, texto: 'Janela de saque' },
    ...marcos.map((m) => ({ cor: m.cor, texto: `${m.rotulo} · mês ${m.mes}` })),
    ...(iHoje >= 0 ? [{ cor: C.rose, texto: `Hoje · mês ${iHoje + 1}` }] : []),
  ];
  for (const item of legenda) {
    ctx.sf(item.cor);
    doc.rect(lx, ctx.y - 1.8, 2.4, 2.4, 'F');
    ctx.st(C.slate);
    doc.text(textoPdf(item.texto), lx + 3.6, ctx.y);
    lx += doc.getTextWidth(textoPdf(item.texto)) + 11;
  }
  ctx.y += 6;
}

// ─── Apuração e indicadores ─────────────────────────────────────────────────

function desenharApuracao(
  d: Documento,
  input: ModelInput,
  r: ModelOutput,
  o: { din: (v: number | null | undefined) => string },
) {
  const { ctx } = d;
  const { apuracao: ap, indicadores: ind } = r;
  const rec = input.receita;

  // Volta ao retrato depois da paisagem do cronograma.
  ctx.addPage('portrait');
  secao(d, 'Apuração do resultado');

  const dre: { rotulo: string; valor: number; negativo?: boolean; total?: boolean }[] = [
    { rotulo: 'Receita bruta (VGV)', valor: ap.receitaBruta },
    { rotulo: '(-) Comissões', valor: ap.comissoes, negativo: true },
    { rotulo: '(-) Cartório / closing', valor: ap.cartorio, negativo: true },
    { rotulo: '(=) Receita líquida', valor: ap.receitaLiquida, total: true },
    { rotulo: '(-) Terrenos', valor: ap.custoTerrenos, negativo: true },
    { rotulo: '(-) Obra', valor: ap.custoObra, negativo: true },
    { rotulo: '(-) Property taxes', valor: ap.custoPropertyTax, negativo: true },
    { rotulo: '(-) Outros custos', valor: ap.custoOutros, negativo: true },
    { rotulo: '(=) Custo do empreendimento', valor: ap.custoEmpreendimento, negativo: true, total: true },
    { rotulo: '(-) Juros', valor: ap.jurosTotais, negativo: true },
    { rotulo: '(-) Fee de estruturação', valor: ap.feeTotal, negativo: true },
    { rotulo: '(=) Custo financeiro', valor: ap.custoFinanceiro, negativo: true, total: true },
    { rotulo: '(=) LUCRO DO PROJETO', valor: ap.lucroProjeto, total: true },
    { rotulo: `Lucro dos investidores (${pct(rec.lucroInvestidoresPct, 0)})`, valor: ap.lucroInvestidores },
    { rotulo: `Lucro do sponsor (${pct(rec.lucroSponsorPct, 0)})`, valor: ap.lucroSponsor },
  ];

  drawTabela(
    ctx,
    distribuir(
      [
        { label: 'Item', width: 130, align: 'left' },
        { label: 'Valor', width: 52, align: 'right' },
      ],
      ctx.contentWidth,
    ),
    dre.map((l) => ({
      celulas: [
        l.rotulo,
        {
          texto: l.negativo ? `(${o.din(l.valor)})` : o.din(l.valor),
          cor: l.negativo || l.valor < 0 ? C.rose : C.navy,
          negrito: !!l.total,
        },
      ],
      fundo: l.total ? C.navySoft : undefined,
      negrito: l.total,
      cor: l.total ? C.navy : undefined,
      altura: 6.6,
    })),
    { tamanhoFonte: 7.5 },
  );
  ctx.y += 5;

  // Os indicadores ficam na MESMA página da apuração: eram duas páginas pela
  // metade, e o leitor precisa ver a conta e o retorno de uma olhada só.
  ctx.st(C.slate);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.text(textoPdf('INDICADORES DE RETORNO'), ctx.marginX, ctx.y);
  ctx.y += 4;
  drawIndicatorCards(
    ctx,
    [
      { label: 'MOIC', value: mult(ind.moic), tone: 'accent' },
      { label: 'ROI', value: pct(ind.roi), tone: 'accent' },
      { label: 'Margem sobre VGV', value: pct(ind.margemVgv) },
      { label: 'LTC por desembolso', value: pct(ind.ltc) },
      { label: 'LTC de pico', value: pct(ind.ltcPico) },
      { label: 'Custo total da dívida', value: pct(ind.custoTotalDividaPct) },
      { label: 'Custo sobre o pico', value: pct(ind.custoTotalDividaPicoPct) },
      { label: 'TIR mensal', value: pct(ind.tirMensal, 2), tone: 'accent' },
      { label: 'TIR anual', value: pct(ind.tirAnual), tone: 'accent' },
      { label: 'XIRR', value: pct(ind.xirr), tone: 'accent' },
    ],
    4,
    { altura: 19, tamanhoValor: 10 },
  );
  ctx.y += 2;
}

// ─── Quadro de investidores ─────────────────────────────────────────────────

/** Do primeiro mês com aporte ao mês da última devolução. Zero quando não há. */
function mesesDeExposicao(s: RateioSocio): { de: number; ate: number; meses: number } | null {
  const primeiro = s.chamadasPorMes.findIndex((v) => v > 0.005);
  let ultimo = -1;
  for (let i = s.devolucoesPorMes.length - 1; i >= 0; i--) {
    if ((s.devolucoesPorMes[i] || 0) > 0.005) { ultimo = i; break; }
  }
  if (primeiro < 0) return null;
  const fim = ultimo >= 0 ? ultimo : primeiro;
  return { de: primeiro + 1, ate: fim + 1, meses: fim - primeiro + 1 };
}

const NOTA_TIRS =
  'O múltiplo é igual para todos os sócios porque o capital é proporcional à participação. As TIRs diferem porque as datas de aporte diferem: quem entra depois fica menos tempo exposto ao mesmo retorno.';

function desenharInvestidores(
  d: Documento,
  input: ModelInput,
  r: ModelOutput,
  o: { dc: (v: number | null | undefined) => string },
) {
  const { ctx } = d;
  const { doc } = ctx;
  secao(d, 'Quadro de investidores');

  const colunas = distribuir(
    [
      { label: 'Sócio', width: 40, align: 'left' },
      { label: 'Participação', width: 21, align: 'right' },
      { label: '% capital', width: 16, align: 'right' },
      { label: 'Capital efetivo', width: 22, align: 'right' },
      { label: 'Meses de exposição', width: 22, align: 'right' },
      { label: 'Lucro', width: 19, align: 'right' },
      { label: 'Total', width: 19, align: 'right' },
      { label: 'MOIC', width: 13, align: 'right' },
      { label: 'TIR a.a.', width: 15, align: 'right' },
    ],
    ctx.contentWidth,
  );

  const linhas: LinhaTabela[] = r.rateioSocios.map((s, i) => {
    const exp = mesesDeExposicao(s);
    return {
      celulas: [
        // A cota ainda por captar é marcada NA célula, não com um selo posto por
        // cima: um selo posicionado por aritmética de altura de linha aponta o
        // sócio errado assim que uma célula quebra em duas linhas.
        {
          texto: s.cotaDisponivel ? `${s.nome || `Sócio ${i + 1}`} · cota disponível` : s.nome || `Sócio ${i + 1}`,
          fundo: s.cotaDisponivel ? C.goldSoft : undefined,
          cor: s.cotaDisponivel ? C.gold : undefined,
          negrito: s.cotaDisponivel,
        },
        pct(s.participacaoPct, 2),
        pct(s.pctCapital, 2),
        o.dc(s.capital),
        exp ? String(exp.meses) : '—',
        o.dc(s.lucro),
        { texto: o.dc(s.total), negrito: true },
        mult(s.moic),
        pct(s.tirAnual),
      ],
    };
  });

  if (r.rateioSocios.length > 0) {
    const soma = (f: (s: RateioSocio) => number) => r.rateioSocios.reduce((a, s) => a + f(s), 0);
    linhas.push({
      celulas: [
        'Total',
        pct(soma((s) => s.participacaoPct), 2),
        pct(soma((s) => s.pctCapital), 2),
        o.dc(soma((s) => s.capital)),
        '',
        o.dc(soma((s) => s.lucro)),
        o.dc(soma((s) => s.total)),
        '',
        '',
      ],
      fundo: C.light,
      negrito: true,
      reguaSuperior: true,
      cor: C.navy,
    });
  }

  drawTabela(ctx, colunas, linhas, { tamanhoFonte: 7 });
  ctx.y += 3;

  // Obrigatória: sem ela, um sócio com TIR de 17% ao lado de outro com 20% e o
  // mesmo múltiplo desconfia do modelo.
  paragrafo(ctx, NOTA_TIRS, 7, C.slate);
  ctx.y += 3;

  // ── Cronograma de aportes do projeto ─────────────────────────────────────
  // Sem a coluna Diferença: aquilo é reconciliação interna do modelo e só
  // levanta pergunta em quem não vai reconciliar nada.
  ctx.ensureSpace(RESERVA_ORFAO);
  ctx.st(C.slate);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(textoPdf('CRONOGRAMA DE APORTES DO PROJETO'), ctx.marginX, ctx.y);
  ctx.y += 4;

  const plano = input.aportes;
  const planejadoPorMes = new Map<number, number>();
  for (const p of plano?.parcelas ?? []) {
    planejadoPorMes.set(p.mes, (planejadoPorMes.get(p.mes) ?? 0) + (p.valor || 0));
  }
  const temPlano = !!plano && (plano.parcelas?.length ?? 0) > 0;
  const totalAportes = r.apuracao.equityTotal;

  const linhasAporte: LinhaTabela[] = [];
  for (const m of r.meses) {
    if (m.equityCall <= 0.005) continue;
    linhasAporte.push({
      celulas: [
        String(m.mes),
        mesAnoLongo(m.data),
        ...(temPlano ? [o.dc(planejadoPorMes.get(m.mes) ?? 0)] : []),
        o.dc(m.equityCall),
        totalAportes === 0 ? '—' : pct(m.equityCall / totalAportes),
        o.dc(m.equityAcumulado),
        totalAportes === 0 ? '—' : pct(m.equityAcumulado / totalAportes),
      ],
    });
  }
  if (linhasAporte.length === 0) {
    linhasAporte.push({
      celulas: [{ texto: 'Nenhum mês com chamada de capital.', cor: C.slate }],
      linhaLarga: true,
      fundo: C.white,
    });
  } else {
    linhasAporte.push({
      celulas: [
        'Total',
        '',
        ...(temPlano ? [o.dc(r.agregados.aportePlanejadoTotal)] : []),
        o.dc(totalAportes),
        '100,0%',
        o.dc(totalAportes),
        '100,0%',
      ],
      fundo: C.light,
      negrito: true,
      reguaSuperior: true,
      cor: C.navy,
    });
  }

  drawTabela(
    ctx,
    distribuir(
      [
        { label: 'Mês', width: 12, align: 'right' },
        { label: 'Data', width: 20, align: 'center' },
        ...(temPlano ? [{ label: 'Planejado', width: 26, align: 'right' as const }] : []),
        { label: 'Aporte do mês', width: 28, align: 'right' },
        { label: '% do total', width: 20, align: 'right' },
        { label: 'Acumulado', width: 28, align: 'right' },
        { label: '% acumulado', width: 22, align: 'right' },
      ],
      ctx.contentWidth,
    ),
    linhasAporte,
    { tamanhoFonte: 7 },
  );
  ctx.y += 4;
}

// ─── P&L por ano-calendário ─────────────────────────────────────────────────

function desenharAnual(d: Documento, r: ModelOutput) {
  const { ctx } = d;
  const anos = apuracaoAnual(r);
  if (anos.length === 0) return;
  const total = totalAnual(anos);

  secao(d, 'P&L por ano-calendário');

  const colunas = distribuir(
    [
      { label: 'Linha', width: 44, align: 'left' as const },
      ...anos.map((a) => ({ label: `${a.ano}\n${a.meses}m`, width: 22, align: 'right' as const })),
      { label: 'Total', width: 26, align: 'right' as const },
    ],
    ctx.contentWidth,
  );

  drawTabela(
    ctx,
    colunas,
    LINHAS_ANUAL.map((def) => ({
      celulas: [
        def.rotulo,
        ...[...anos, total].map((col) => {
          const v = col[def.chave] as number;
          const texto = def.deducao
            ? v === 0
              ? '—'
              : `(${dinheiroCurto(Math.abs(v))})`
            : dinheiroCurto(v);
          return { texto, cor: !def.deducao && v < 0 ? C.rose : undefined, negrito: def.total };
        }),
      ],
      fundo: def.total ? C.navySoft : undefined,
      negrito: def.total || def.subtotal,
      cor: def.total ? C.navy : undefined,
      reguaSuperior: def.subtotal,
      altura: 6.5,
    })),
    { tamanhoFonte: 7, tamanhoCabecalho: 6.5, alturaCabecalho: 10 },
  );
  ctx.y += 2;
  paragrafo(
    ctx,
    'Comissão e cartório incidem sobre a receita de cada ano, não sobre o VGV total. O primeiro e o último ano são parciais — a contagem de meses está no cabeçalho.',
    6.5,
    C.slate,
  );
  ctx.y += 2;
}

// ─── Sensibilidade e cenários ───────────────────────────────────────────────

function desenharSensibilidade(
  d: Documento,
  input: ModelInput,
  r: ModelOutput,
  o: { dc: (v: number | null | undefined) => string; equilibrio: ReturnType<typeof pontosDeEquilibrio> },
) {
  const { ctx } = d;
  const { doc } = ctx;
  const grade = gradeSensibilidade(input);
  const atrasos = sensibilidadePrazo(input);

  secao(d, 'Sensibilidade e cenários');

  // ── A frase de leitura ───────────────────────────────────────────────────
  // Derivada, não escrita: quem lê precisa saber o que a matriz diz, e o que
  // ela diz muda com o projeto.
  const base = atrasos.find((a) => a.mesesAtraso === 0) ?? atrasos[0];
  const pior = atrasos[atrasos.length - 1];
  const iBase = VARIACOES_PRECO.indexOf(0);
  const iCusto = VARIACOES_CUSTO.indexOf(0);
  const piorPreco = grade[0]?.[iCusto >= 0 ? iCusto : 0];
  const tirBase = iBase >= 0 ? grade[iBase]?.[iCusto >= 0 ? iCusto : 0]?.tirAnual ?? r.indicadores.tirAnual : r.indicadores.tirAnual;

  if (base && pior && pior.mesesAtraso > 0 && finito(tirBase)) {
    const quedaPrazo = finito(pior.tirAnual) ? tirBase - pior.tirAnual : null;
    const quedaPreco = finito(piorPreco?.tirAnual) ? tirBase - (piorPreco.tirAnual as number) : null;
    const moicMove = finito(base.moic) && finito(pior.moic) ? Math.abs(base.moic - pior.moic) : null;
    // A comparação é entre os dois piores cenários DESTA seção — o maior atraso
    // e a maior queda de preço da grade. Dizer "mais sensível a X" sem dizer
    // contra o quê seria opinião; com os dois números ao lado, é leitura.
    const comparacao =
      quedaPrazo !== null && quedaPreco !== null
        ? quedaPrazo >= quedaPreco
          ? 'a operação é mais sensível ao prazo que ao preço'
          : 'a operação é mais sensível ao preço que ao prazo'
        : 'a operação responde ao prazo';
    const efeitoMoic =
      moicMove === null
        ? ''
        : moicMove < 0.05
          ? ', enquanto o múltiplo quase não se move'
          : `, e o múltiplo vai de ${mult(base.moic)} para ${mult(pior.moic)}`;
    const contraPreco =
      quedaPreco === null
        ? ''
        : ` (uma queda de ${pct(Math.abs(VARIACOES_PRECO[0]), 0)} no preço a levaria a ${pct(piorPreco.tirAnual)})`;
    paragrafo(
      ctx,
      `Comparados os dois piores cenários desta seção, ${comparacao}: um atraso de ${plural(pior.mesesAtraso, 'mês', 'meses')} derruba a TIR de ${pct(tirBase)} para ${pct(pior.tirAnual)}${contraPreco}${efeitoMoic}.`,
      9,
      C.navy,
    );
    ctx.y += 1;
  }

  // ── As duas matrizes ─────────────────────────────────────────────────────
  const colsGrade = distribuir(
    [
      { label: 'Preço \\ Obra', width: 32, align: 'left' as const },
      ...VARIACOES_CUSTO.map((vc) => ({
        label: `${vc > 0 ? '+' : ''}${(vc * 100).toFixed(0)}%`,
        width: 30,
        align: 'right' as const,
      })),
    ],
    ctx.contentWidth,
  );

  const matriz = (titulo: string, valor: (c: (typeof grade)[0][0]) => string, colorir: boolean) => {
    ctx.ensureSpace(12 + grade.length * 7);
    ctx.st(C.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(textoPdf(titulo), ctx.marginX, ctx.y);
    ctx.y += 4;
    drawTabela(
      ctx,
      colsGrade,
      grade.map((linha, i) => ({
        celulas: [
          {
            texto: `${VARIACOES_PRECO[i] > 0 ? '+' : ''}${(VARIACOES_PRECO[i] * 100).toFixed(0)}%`,
            negrito: true,
            cor: C.navy,
          },
          ...linha.map((c) => ({
            texto: valor(c),
            cor: colorir ? (c.lucroProjeto < 0 ? C.rose : C.green) : C.graphite,
            fundo: c.variacaoPreco === 0 && c.variacaoCusto === 0 ? C.navySoft : undefined,
          })),
        ],
      })),
      { tamanhoFonte: 7 },
    );
    ctx.y += 5;
  };

  matriz('Lucro do projeto', (c) => o.dc(c.lucroProjeto), true);
  matriz('MOIC', (c) => mult(c.moic), false);

  // ── Pontos de equilíbrio ─────────────────────────────────────────────────
  ctx.ensureSpace(RESERVA_ORFAO);
  ctx.st(C.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(textoPdf('Pontos de equilíbrio'), ctx.marginX, ctx.y);
  ctx.y += 4;
  drawTabela(
    ctx,
    distribuir(
      [
        { label: 'Ponto de equilíbrio', width: 70, align: 'left' as const },
        { label: 'Valor', width: 56, align: 'right' as const },
        { label: 'Referência atual', width: 56, align: 'right' as const },
      ],
      ctx.contentWidth,
    ),
    [
      {
        celulas: [
          'VGV mínimo',
          o.equilibrio.vgvMinimo === null ? '—' : o.dc(o.equilibrio.vgvMinimo),
          o.dc(r.agregados.vgv),
        ],
      },
      { celulas: ['Queda máxima no preço', pct(o.equilibrio.quedaMaximaPreco), 'antes do prejuízo'] },
      {
        celulas: [
          'Custo de obra máximo',
          o.equilibrio.custoObraMaximo === null ? '—' : o.dc(o.equilibrio.custoObraMaximo),
          o.dc(r.agregados.obraTotal),
        ],
      },
      { celulas: ['Alta máxima na obra', pct(o.equilibrio.altaMaximaCusto), 'antes do prejuízo'] },
    ],
    { tamanhoFonte: 7 },
  );
  ctx.y += 5;

  // ── Sensibilidade ao prazo ───────────────────────────────────────────────
  ctx.ensureSpace(RESERVA_ORFAO);
  ctx.st(C.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(textoPdf('Sensibilidade ao prazo'), ctx.marginX, ctx.y);
  ctx.y += 4;
  drawTabela(
    ctx,
    distribuir(
      [
        { label: 'Atraso', width: 40, align: 'left' as const },
        { label: 'Prazo total', width: 30, align: 'right' as const },
        { label: 'Lucro do projeto', width: 42, align: 'right' as const },
        { label: 'MOIC', width: 34, align: 'right' as const },
        { label: 'TIR anual', width: 36, align: 'right' as const },
      ],
      ctx.contentWidth,
    ),
    atrasos.map((a) => ({
      celulas: [
        a.mesesAtraso === 0 ? 'Sem atraso (base)' : `+${plural(a.mesesAtraso, 'mês', 'meses')}`,
        `${a.prazoTotal} m`,
        { texto: o.dc(a.lucroProjeto), cor: a.lucroProjeto < 0 ? C.rose : C.graphite },
        mult(a.moic),
        pct(a.tirAnual),
      ],
      fundo: a.mesesAtraso === 0 ? C.light : undefined,
      negrito: a.mesesAtraso === 0,
    })),
    { tamanhoFonte: 7 },
  );
  ctx.y += 4;
}

// ─── Anexo A · Fluxo de caixa mensal ────────────────────────────────────────

interface DefinicaoLinhaFluxo {
  rotulo: string;
  valor: (m: MesFluxo) => number;
  linha?: string;
  destaque?: boolean;
  separador?: boolean;
  /** Saldo, não fluxo: a coluna Total leva travessão. */
  saldo?: boolean;
  /** Indentação em mm — a hierarquia do orçamento. */
  recuo?: number;
  fundo?: RgbColor;
  negrito?: boolean;
  italico?: boolean;
}

function desenharAnexoFluxo(d: Documento, input: ModelInput, r: ModelOutput) {
  const { ctx } = d;
  const { doc } = ctx;
  const meses = r.meses;
  if (meses.length === 0) return;

  const overrides = new Set<string>();
  for (const o of input.overrides ?? []) overrides.add(`${o.mes}:${o.linha}`);

  // ── Custos, linha a linha ────────────────────────────────────────────────
  // `agruparCustosPorCategoria` já existe e é a ÚNICA implementação do
  // agrupamento — reagrupar aqui criaria uma segunda verdade.
  const grupos = agruparCustosPorCategoria(r.detalhamentoCustos, r.cronograma.prazoTotal);
  const lancou = (porMes: number[]) => porMes.some((v) => Math.abs(v || 0) > 0.005);
  const semLancamento = r.detalhamentoCustos.filter((c) => !lancou(c.porMes)).length;

  const linhasCusto: DefinicaoLinhaFluxo[] = [];
  for (const g of grupos) {
    const itens = g.itens.filter((c) => lancou(c.porMes));
    if (itens.length === 0) continue;
    linhasCusto.push({
      rotulo: ROTULO_CATEGORIA[g.categoria],
      valor: (m) => g.porMes[m.mes - 1] || 0,
      fundo: C.light,
      negrito: true,
    });
    for (const item of itens) {
      linhasCusto.push({
        rotulo: item.label?.trim() ? item.label : 'Sem descrição',
        valor: (m) => item.porMes[m.mes - 1] || 0,
        recuo: 3,
        italico: !item.label?.trim(),
      });
    }
  }
  // O detalhamento é SEMPRE anterior aos overrides. Quando o usuário forçou a
  // linha de custos à mão, a diferença aparece como ajuste — é o que faz a soma
  // das categorias fechar com `otherCosts` do mês, e não uma conta nova.
  const ajuste = (m: MesFluxo) =>
    m.otherCosts - grupos.reduce((a, g) => a + (g.porMes[m.mes - 1] || 0), 0);
  if (meses.some((m) => Math.abs(ajuste(m)) > 0.005)) {
    linhasCusto.push({ rotulo: 'Ajuste manual da linha de custos', valor: ajuste, recuo: 3 });
  }

  const linhas: DefinicaoLinhaFluxo[] = [
    { rotulo: 'Terrenos', valor: (m) => m.land, linha: 'land' },
    { rotulo: 'Obra', valor: (m) => m.construction, linha: 'construction' },
    { rotulo: 'Property taxes', valor: (m) => m.propertyTax, linha: 'property_tax' },
    { rotulo: 'Custos', valor: (m) => m.otherCosts, linha: 'other_costs', destaque: true },
    ...linhasCusto,
    { rotulo: 'Juros e taxas', valor: (m) => m.custoFinanceiroCaixa, separador: true },
    { rotulo: 'Total de pagamentos', valor: (m) => m.pagamentos, destaque: true },
    { rotulo: 'Receita', valor: (m) => m.revenue, linha: 'revenue', separador: true },
    { rotulo: 'Saque', valor: (m) => m.draw, linha: 'draw' },
    { rotulo: 'Amortização', valor: (m) => m.amortization, linha: 'amortization' },
    { rotulo: 'Aporte de equity', valor: (m) => m.equityCall, linha: 'equity_call', destaque: true },
    { rotulo: 'Distribuição', valor: (m) => m.distribution, linha: 'distribution' },
    { rotulo: 'Saldo devedor', valor: (m) => m.saldoDevedor, separador: true, saldo: true },
    { rotulo: 'Equity acumulado', valor: (m) => m.equityAcumulado, saldo: true },
    { rotulo: 'Caixa do mês', valor: (m) => m.caixaMes },
    { rotulo: 'Caixa acumulado', valor: (m) => m.caixaAcumulado, destaque: true, saldo: true },
  ];

  const BLOCO = 12;
  let primeiro = true;
  // A altura da linha é calculada UMA vez, pela página mais apertada do anexo —
  // a primeira, que ainda carrega a faixa do título. Com ela igual em todos os
  // blocos, cada bloco de 12 meses cabe numa página só: era o estouro de duas
  // linhas que produzia uma página de sobra a cada bloco.
  let alturaLinha: number | null = null;
  for (let inicio = 0; inicio < meses.length; inicio += BLOCO) {
    const bloco = meses.slice(inicio, inicio + BLOCO);
    // Segunda quebra deliberada: o anexo começa em página nova, e cada bloco de
    // 12 meses precisa da página inteira em paisagem.
    ctx.addPage('landscape');
    if (primeiro) {
      anexo(d, 'A', 'Fluxo de caixa mensal', 'Todos os meses do projeto, custo a custo');
      primeiro = false;
    }
    ctx.ensureSpace(20);
    ctx.st(C.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      textoPdf(`Anexo A · Fluxo de caixa · meses ${bloco[0].mes} a ${bloco[bloco.length - 1].mes}`),
      ctx.marginX,
      ctx.y,
    );
    ctx.y += 4;
    ctx.sd(C.border);
    doc.setLineWidth(0.35);
    doc.line(ctx.marginX, ctx.y, ctx.pageWidth - ctx.marginX, ctx.y);
    ctx.y += 4;

    if (alturaLinha === null) {
      const ALTURA_CABECALHO = 9;
      const ALTURA_NOTAS = 14;
      const disponivel =
        ctx.pageHeight - ctx.bottomReserve - ctx.y - ALTURA_CABECALHO - ALTURA_NOTAS;
      alturaLinha = Math.max(3.6, Math.min(6.5, disponivel / Math.max(1, linhas.length)));
    }
    const fonteLinha = Math.max(5.2, Math.min(6.5, alturaLinha - 0.3));

    const colunas = distribuir(
      [
        { label: 'Linha', width: 40, align: 'left' as const },
        ...bloco.map((m) => ({
          label: `${m.mes}\n${mesAnoLongo(m.data)}`,
          width: 17,
          align: 'right' as const,
        })),
        { label: 'Total', width: 19, align: 'right' as const },
      ],
      ctx.contentWidth,
    );

    drawTabela(
      ctx,
      colunas,
      linhas.map((def) => {
        // O total é o do PERÍODO INTEIRO, como na tela — não o do bloco.
        const total = def.saldo ? null : meses.reduce((a, m) => a + def.valor(m), 0);
        return {
          celulas: [
            {
              texto: def.recuo ? `${' '.repeat(def.recuo)}${def.rotulo}` : def.rotulo,
              italico: def.italico,
              negrito: def.negrito || def.destaque,
            },
            ...bloco.map((m) => {
              const v = def.valor(m);
              const manual = !!def.linha && overrides.has(`${m.mes}:${def.linha}`);
              return {
                texto: dinheiroCurto(v),
                // -1e-12 não é um número negativo para quem lê: `dinheiroCurto`
                // já o escreve como 0, e pintá-lo de vermelho seria mentira.
                cor: v < -0.005 ? C.rose : undefined,
                fundo: manual ? C.goldSoft : undefined,
                negrito: def.destaque,
              };
            }),
            { texto: total === null ? '—' : dinheiroCurto(total), negrito: true },
          ],
          fundo: def.destaque ? C.navySoft : def.fundo,
          negrito: def.destaque || def.negrito,
          cor: def.destaque ? C.navy : undefined,
          reguaSuperior: def.separador,
          altura: alturaLinha as number,
        };
      }),
      { tamanhoFonte: fonteLinha, tamanhoCabecalho: fonteLinha - 0.2, alturaCabecalho: 9 },
    );

    ctx.y += 2;
    const notas = [
      'Saldo devedor, Equity acumulado e Caixa acumulado são saldos, não fluxos — não somam na coluna Total.',
      semLancamento > 0
        ? `${plural(semLancamento, 'custo', 'custos')} sem lançamento no período — sem linha na tabela.`
        : '',
      r.celulasManuais > 0
        ? `${plural(r.celulasManuais, 'célula', 'células')} em modo manual — fundo âmbar.`
        : '',
    ].filter(Boolean);
    paragrafo(ctx, notas.join(' '), 6.5, C.slate);
  }
}

// ─── Anexo B · Resultado por sócio ──────────────────────────────────────────

function desenharAnexoSocios(
  d: Documento,
  r: ModelOutput,
  o: { dc: (v: number | null | undefined) => string; din: (v: number | null | undefined) => string },
) {
  const { ctx } = d;
  const { doc } = ctx;
  if (r.rateioSocios.length === 0) return;

  // Terceira e última quebra deliberada.
  ctx.addPage('portrait');
  anexo(d, 'B', 'Resultado por sócio', 'O que cada um pôs, quando, e o que recebe de volta');

  const colunas = distribuir(
    [
      { label: 'Mês', width: 14, align: 'right' },
      { label: 'Data', width: 22, align: 'center' },
      { label: 'Aporte', width: 30, align: 'right' },
      { label: 'Devolução', width: 30, align: 'right' },
      { label: 'Fluxo líquido', width: 32, align: 'right' },
      { label: 'Acumulado', width: 32, align: 'right' },
    ],
    ctx.contentWidth,
  );

  r.rateioSocios.forEach((s, indice) => {
    const linhas = linhasDoSocio(r, s, o.dc);
    // Dois sócios por página quando o número de linhas permite — cinco sócios
    // não podem virar cinco páginas com um terço de conteúdo cada.
    const alturaBloco = 10 + 2 * 20 + 4 + 8 + linhas.length * 6 + 8;
    ctx.ensureSpace(Math.min(alturaBloco, ctx.pageHeight - ctx.topStart - ctx.bottomReserve));

    // ── Cabeçalho do sócio ─────────────────────────────────────────────────
    ctx.st(C.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const nome = s.nome || `Sócio ${indice + 1}`;
    doc.text(textoPdf(nome), ctx.marginX, ctx.y + 3.5);
    const larguraNome = doc.getTextWidth(textoPdf(nome));
    if (s.cotaDisponivel) {
      drawBadge(ctx, ctx.marginX + larguraNome + 4, ctx.y - 0.4, 'COTA DISPONÍVEL', 'accent', {
        tamanho: 6,
      });
    }
    ctx.st(C.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      textoPdf(`participação ${pct(s.participacaoPct, 2)} · ${pct(s.pctCapital, 2)} do capital`),
      ctx.pageWidth - ctx.marginX,
      ctx.y + 3.5,
      { align: 'right' },
    );
    ctx.y += 7;

    drawIndicatorCards(
      ctx,
      [
        { label: 'Capital aportado', value: o.din(s.capital), tone: 'highlight' },
        { label: 'Total recebido', value: o.din(s.total), tone: 'positive' },
        { label: 'Lucro', value: o.din(s.lucro), tone: s.lucro < 0 ? 'negative' : 'positive' },
        { label: 'MOIC', value: mult(s.moic), tone: 'accent' },
        { label: 'ROI', value: pct(s.roi), tone: 'accent' },
        { label: 'TIR anual', value: pct(s.tirAnual), tone: 'accent' },
        { label: 'XIRR', value: pct(s.xirr), tone: 'accent' },
      ],
      4,
      { altura: 17, tamanhoValor: 9 },
    );

    drawTabela(ctx, colunas, linhas, { tamanhoFonte: 6.8, alturaLinha: 6 });
    ctx.y += 6;
  });

  ctx.ensureSpace(14);
  paragrafo(ctx, NOTA_TIRS, 7, C.slate);
  ctx.y += 2;
}

/**
 * Meses com movimento mais o último do projeto. Os zerados do meio somem, e a
 * omissão é declarada — uma tabela que pula de mês 5 para mês 19 sem dizer nada
 * parece dado faltando.
 */
function linhasDoSocio(
  r: ModelOutput,
  s: RateioSocio,
  dc: (v: number | null | undefined) => string,
): LinhaTabela[] {
  const n = r.meses.length;
  const temMovimento = (i: number) =>
    Math.abs(s.chamadasPorMes[i] || 0) > 0.005 || Math.abs(s.devolucoesPorMes[i] || 0) > 0.005;

  const linhas: LinhaTabela[] = [];
  let acumulado = 0;
  let omitidos = 0;
  for (let i = 0; i < n; i++) {
    const aporte = s.chamadasPorMes[i] || 0;
    const devolucao = s.devolucoesPorMes[i] || 0;
    acumulado += devolucao - aporte;
    const mostrar = temMovimento(i) || i === n - 1;
    if (!mostrar) { omitidos++; continue; }
    if (omitidos > 0) {
      linhas.push({
        celulas: [{ texto: `… ${plural(omitidos, 'mês sem movimento', 'meses sem movimento')}`, cor: C.slate, tamanho: 6.2 }],
        linhaLarga: true,
        fundo: C.white,
        altura: 5,
      });
      omitidos = 0;
    }
    const liquido = devolucao - aporte;
    linhas.push({
      celulas: [
        String(r.meses[i].mes),
        mesAnoLongo(r.meses[i].data),
        aporte > 0.005 ? dc(aporte) : '—',
        devolucao > 0.005 ? dc(devolucao) : '—',
        { texto: dc(liquido), cor: liquido < 0 ? C.rose : C.green },
        { texto: dc(acumulado), cor: acumulado < 0 ? C.rose : C.green, negrito: true },
      ],
    });
  }
  return linhas;
}

// ─── Saída ──────────────────────────────────────────────────────────────────

export function nomeArquivoSocios(input: ModelInput): string {
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return `${nomeSeguro(`relatorio_socios_${input.nome || 'sem_nome'}_${data}`)}.pdf`;
}

export function exportarPdfSocios(input: ModelInput, resultado: ModelOutput): void {
  construirPdfSocios(input, resultado).save(nomeArquivoSocios(input));
}
