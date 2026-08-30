/**
 * Design system dos relatórios PDF.
 *
 * Extraído de `exportToPDF` (utils/export.ts), que era o único lugar onde a
 * paleta e os blocos de layout existiam. Nada aqui calcula número algum: são só
 * primitivas de desenho sobre um `jsPDF` já criado.
 *
 * Todas as medidas são em milímetros — o documento é criado com `unit: 'mm'`.
 */
import type jsPDF from 'jspdf';

export type RgbColor = [number, number, number];

/** Paleta do sistema. Os valores são os mesmos desde o primeiro relatório. */
export const C = {
  navy:      [17, 31, 59]    as RgbColor,
  navySoft:  [229, 236, 246] as RgbColor,
  graphite:  [59, 68, 82]    as RgbColor,
  slate:     [107, 114, 128] as RgbColor,
  border:    [217, 223, 232] as RgbColor,
  light:     [245, 247, 250] as RgbColor,
  white:     [255, 255, 255] as RgbColor,
  green:     [22, 101, 52]   as RgbColor,
  greenSoft: [236, 253, 245] as RgbColor,
  rose:      [190, 24, 93]   as RgbColor,
  roseSoft:  [255, 241, 242] as RgbColor,
  blue:      [29, 78, 216]   as RgbColor,
  blueSoft:  [239, 246, 255] as RgbColor,
  gold:      [146, 103, 33]  as RgbColor,
  goldSoft:  [255, 251, 235] as RgbColor,
};

/** Tons dos cartões e badges. Um tom escolhe fundo, texto e borda de uma vez. */
export type Tom = 'default' | 'positive' | 'negative' | 'highlight' | 'accent';

export function paletaDoTom(tom: Tom): { bg: RgbColor; text: RgbColor; border: RgbColor } {
  return tom === 'positive'
    ? { bg: C.greenSoft, text: C.green,    border: C.border }
    : tom === 'negative'
      ? { bg: C.roseSoft,  text: C.rose,     border: C.border }
      : tom === 'highlight'
        ? { bg: C.navySoft,  text: C.navy,     border: C.navy }
        : tom === 'accent'
          ? { bg: C.goldSoft,  text: C.gold,     border: C.border }
          : { bg: C.white,     text: C.graphite, border: C.border };
}

/** Floco de 8 pontas da marca. `size` é o lado da caixa que o contém. */
export function drawLogo(doc: jsPDF, lx: number, ly: number, size: number, color: RgbColor) {
  const cx = lx + size / 2, cy = ly + size / 2;
  const inner = size * 0.08, outer = size * 0.31, outerR = size * 0.065;
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.8);
  const pts = [
    { dx: 0, dy: -outer }, { dx: outer * 0.72, dy: -outer * 0.72 },
    { dx: outer, dy: 0 }, { dx: outer * 0.72, dy: outer * 0.72 },
    { dx: 0, dy: outer }, { dx: -outer * 0.72, dy: outer * 0.72 },
    { dx: -outer, dy: 0 }, { dx: -outer * 0.72, dy: -outer * 0.72 },
  ];
  pts.forEach(p => { doc.line(cx, cy, cx + p.dx, cy + p.dy); doc.circle(cx + p.dx, cy + p.dy, outerR, 'FD'); });
  doc.circle(cx, cy, inner, 'FD');
}

/**
 * Estado de desenho de um relatório: cursor vertical, margens e os atalhos de
 * cor. `pageWidth`/`pageHeight` são getters porque a página corrente pode ser
 * paisagem — quem desenha nunca deve guardar a largura numa variável.
 */
export interface ContextoPdf {
  doc: jsPDF;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;
  marginX: number;
  bottomReserve: number;
  topStart: number;
  /** Cursor vertical. Toda primitiva avança este valor. */
  y: number;
  sf: (color: RgbColor) => void;
  sd: (color: RgbColor) => void;
  st: (color: RgbColor) => void;
  addPage: (orientacao?: 'portrait' | 'landscape') => void;
  ensureSpace: (h: number) => void;
}

export function criarContexto(doc: jsPDF): ContextoPdf {
  const ctx: ContextoPdf = {
    doc,
    get pageWidth() { return doc.internal.pageSize.width; },
    get pageHeight() { return doc.internal.pageSize.height; },
    get contentWidth() { return doc.internal.pageSize.width - ctx.marginX * 2; },
    marginX: 14,
    bottomReserve: 18,
    topStart: 14,
    y: 14,
    sf: (color) => doc.setFillColor(color[0], color[1], color[2]),
    sd: (color) => doc.setDrawColor(color[0], color[1], color[2]),
    st: (color) => doc.setTextColor(color[0], color[1], color[2]),
    addPage: (orientacao) => {
      if (orientacao) doc.addPage('a4', orientacao);
      else doc.addPage();
      ctx.y = ctx.topStart;
    },
    ensureSpace: (h) => { if (ctx.y + h > ctx.pageHeight - ctx.bottomReserve) ctx.addPage(); },
  };
  return ctx;
}

export interface OpcoesCabecalho {
  titulo: string;
  subtitulo: string;
  badge: string;
  emitidoEm: string;
  /** Texto pequeno no canto superior direito. */
  eyebrow?: string;
}

/** Bloco navy da primeira página. */
export function drawHeader(ctx: ContextoPdf, o: OpcoesCabecalho) {
  const { doc, marginX, contentWidth, pageWidth, sf, st, sd } = ctx;
  const h = 34;
  sf(C.navy); doc.roundedRect(marginX, ctx.y, contentWidth, h, 4, 4, 'F');
  drawLogo(doc, marginX + 5, ctx.y + 5, 18, C.white);
  st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('PROVISION', marginX + 28, ctx.y + 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(o.eyebrow ?? 'Relatório Financeiro', pageWidth - marginX - 4, ctx.y + 8, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(o.titulo, marginX + 28, ctx.y + 18);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text(o.subtitulo, marginX + 28, ctx.y + 25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`Emitido em ${o.emitidoEm}`, marginX + 28, ctx.y + 30);
  sf(C.white); doc.roundedRect(pageWidth - marginX - 42, ctx.y + 21, 38, 8, 3, 3, 'F');
  st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text(o.badge, pageWidth - marginX - 23, ctx.y + 26.2, { align: 'center' });
  ctx.y += h + 4;
  sd(C.border); doc.setLineWidth(0.4);
  doc.line(marginX, ctx.y, pageWidth - marginX, ctx.y);
  ctx.y += 8;
}

/** Sobrancelha + título + régua. `modo` esconde uma das duas linhas de texto. */
export function drawSectionTitle(
  ctx: ContextoPdf,
  eyebrow: string,
  titulo: string,
  modo: 'both' | 'eyebrow' | 'title' = 'both',
) {
  const { doc, marginX, pageWidth, st, sd } = ctx;
  ctx.ensureSpace(16);
  if (modo !== 'title' && eyebrow) {
    st(C.slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(eyebrow.toUpperCase(), marginX, ctx.y);
    ctx.y += 4;
  }
  if (modo !== 'eyebrow' && titulo) {
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(titulo, marginX, ctx.y);
    ctx.y += 4.5;
  }
  sd(C.border); doc.setLineWidth(0.35);
  doc.line(marginX, ctx.y, pageWidth - marginX, ctx.y);
  ctx.y += 6;
}

export interface ParInfo { label: string; value: string }

/** Cards de identificação em duas colunas. */
export function drawInfoBlock(ctx: ContextoPdf, pares: ParInfo[]) {
  const { doc, marginX, contentWidth, sf, sd, st } = ctx;
  const gap = 5;
  const colWidth = (contentWidth - gap) / 2;
  const rowHeights: number[] = [];
  for (let i = 0; i < pares.length; i += 2) {
    const par = pares.slice(i, i + 2);
    rowHeights.push(par.reduce((rh, item) => Math.max(rh, 10 + doc.splitTextToSize(item.value, colWidth - 8).length * 4.2), 16));
  }
  ctx.ensureSpace(rowHeights.reduce((s, rh) => s + rh + 4, 0));
  let localY = ctx.y;
  pares.forEach((item, index) => {
    const rowIndex = Math.floor(index / 2);
    const colIndex = index % 2;
    const x = marginX + colIndex * (colWidth + gap);
    const boxH = rowHeights[rowIndex];
    sf(C.light); sd(C.border); doc.roundedRect(x, localY, colWidth, boxH, 3, 3, 'FD');
    st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(item.label.toUpperCase(), x + 4, localY + 5);
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(doc.splitTextToSize(item.value, colWidth - 8), x + 4, localY + 10.5);
    if (colIndex === 1) localY += boxH + 4;
  });
  // Contagem ímpar: a última linha não fechou no laço acima.
  if (pares.length % 2 !== 0) localY += rowHeights[rowHeights.length - 1] + 4;
  ctx.y = localY + 2;
}

export interface CartaoIndicador { label: string; value: string; tone?: Tom }

export interface OpcoesCartoes {
  /** Altura do cartão. 20 é o padrão histórico de 2 colunas. */
  altura?: number;
  /** Corpo do valor. 12 é o padrão histórico de 2 colunas. */
  tamanhoValor?: number;
}

export function drawIndicatorCards(
  ctx: ContextoPdf,
  cards: CartaoIndicador[],
  colunas = 2,
  opcoes: OpcoesCartoes = {},
) {
  const { doc, marginX, contentWidth, sf, sd, st } = ctx;
  const gap = 4;
  const cols = Math.max(1, colunas);
  const cardWidth = (contentWidth - gap * (cols - 1)) / cols;
  const cardHeight = opcoes.altura ?? 20;
  const tamanhoValor = opcoes.tamanhoValor ?? 12;
  let localY = ctx.y;
  cards.forEach((card, index) => {
    if (index % cols === 0) {
      // Trocar de página no meio de uma fileira deixaria cartões órfãos.
      if (localY + cardHeight > ctx.pageHeight - ctx.bottomReserve) { ctx.addPage(); localY = ctx.y; }
    }
    const cx = marginX + (index % cols) * (cardWidth + gap);
    const palette = paletaDoTom(card.tone ?? 'default');
    sf(palette.bg); sd(palette.border); doc.roundedRect(cx, localY, cardWidth, cardHeight, 3, 3, 'FD');
    if ((card.tone ?? 'default') === 'highlight') { sf(C.navy); doc.roundedRect(cx, localY, cardWidth, 3, 3, 3, 'F'); }
    st(C.slate); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(card.label.toUpperCase(), cx + 4, localY + 7);
    st(palette.text); doc.setFont('helvetica', 'bold'); doc.setFontSize(tamanhoValor);
    doc.text(doc.splitTextToSize(card.value, cardWidth - 8), cx + 4, localY + 14);
    if (index % cols === cols - 1) localY += cardHeight + gap;
  });
  if (cards.length % cols !== 0) localY += cardHeight + gap;
  ctx.y = localY + 2;
}

export interface OpcoesBadge {
  largura?: number;
  tamanho?: number;
  /** Sobrepõe as cores do tom. */
  fundo?: RgbColor;
  cor?: RgbColor;
}

/** Retângulo arredondado de 5 mm com o texto centralizado. Devolve a largura. */
export function drawBadge(
  ctx: ContextoPdf,
  x: number,
  y: number,
  texto: string,
  tom: Tom = 'default',
  opcoes: OpcoesBadge = {},
): number {
  const { doc, sf, st } = ctx;
  const palette = paletaDoTom(tom);
  const tamanho = opcoes.tamanho ?? 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(tamanho);
  const largura = opcoes.largura ?? doc.getTextWidth(texto) + 4;
  sf(opcoes.fundo ?? palette.bg);
  doc.roundedRect(x, y, largura, 5, 2, 2, 'F');
  st(opcoes.cor ?? palette.text);
  doc.text(texto, x + largura / 2, y + 3.7, { align: 'center' });
  return largura;
}

export type AlinhamentoColuna = 'left' | 'center' | 'right';

export interface ColunaTabela {
  label: string;
  width: number;
  align?: AlinhamentoColuna;
}

export interface CelulaTabela {
  texto: string;
  align?: AlinhamentoColuna;
  cor?: RgbColor;
  fundo?: RgbColor;
  negrito?: boolean;
  tamanho?: number;
}

export interface LinhaTabela {
  celulas: (string | CelulaTabela)[];
  /** Sobrepõe a zebra. */
  fundo?: RgbColor;
  cor?: RgbColor;
  negrito?: boolean;
  /** Régua fina acima da linha — usada em totais e separadores. */
  reguaSuperior?: boolean;
  altura?: number;
  /**
   * Linha corrida: só a primeira célula é desenhada, ocupando a largura inteira
   * da tabela. É como uma nota ou um "como resolver" entra sem virar coluna.
   */
  linhaLarga?: boolean;
}

export interface OpcoesTabela {
  /** Origem horizontal. Default: `ctx.marginX`. */
  x?: number;
  /** Origem vertical. Quando informado, a tabela flutua: não mexe em `ctx.y` nem quebra página. */
  y?: number;
  tamanhoFonte?: number;
  tamanhoCabecalho?: number;
  alturaCabecalho?: number;
  alturaLinha?: number;
  zebra?: boolean;
  /** Quebra o texto das células em várias linhas. Custa altura variável. */
  quebrarTexto?: boolean;
}

const alinhamentoJsPdf = (a: AlinhamentoColuna | undefined) =>
  a === 'right' ? 'right' : a === 'center' ? 'center' : 'left';

/**
 * Tabela do sistema: header navy, zebra clara, header repetido a cada página.
 * Devolve o `y` final (igual a `ctx.y` no modo normal).
 */
export function drawTabela(
  ctx: ContextoPdf,
  colunas: ColunaTabela[],
  linhas: LinhaTabela[],
  opcoes: OpcoesTabela = {},
): number {
  const { doc, sf, sd, st } = ctx;
  const x0 = opcoes.x ?? ctx.marginX;
  const flutuante = opcoes.y !== undefined;
  const fonte = opcoes.tamanhoFonte ?? 7.5;
  const fonteCab = opcoes.tamanhoCabecalho ?? 7.5;
  const alturaCab = opcoes.alturaCabecalho ?? 8;
  const alturaBase = opcoes.alturaLinha ?? 7;
  const zebra = opcoes.zebra ?? true;
  const larguraTotal = colunas.reduce((a, c) => a + c.width, 0);

  const colX: number[] = [];
  let rx = x0;
  colunas.forEach(c => { colX.push(rx); rx += c.width; });

  const posX = (i: number, align: AlinhamentoColuna | undefined) =>
    align === 'right' ? colX[i] + colunas[i].width - 2
      : align === 'center' ? colX[i] + colunas[i].width / 2
        : colX[i] + 2;

  let y = flutuante ? (opcoes.y as number) : ctx.y;

  const desenharCabecalho = () => {
    sf(C.navy); doc.rect(x0, y, larguraTotal, alturaCab, 'F');
    st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(fonteCab);
    colunas.forEach((col, i) => {
      doc.text(col.label, posX(i, col.align), y + alturaCab / 2 + 1.4, { align: alinhamentoJsPdf(col.align) });
    });
    y += alturaCab;
  };

  if (!flutuante) ctx.ensureSpace(alturaCab + alturaBase);
  if (!flutuante) y = ctx.y;
  desenharCabecalho();

  linhas.forEach((linha, index) => {
    const colunasDaLinha = linha.linhaLarga ? [{ label: '', width: larguraTotal, align: 'left' as const }] : colunas;
    const textos = colunasDaLinha.map((col, i) => {
      const bruta = linha.celulas[i];
      const celula: CelulaTabela = typeof bruta === 'string' ? { texto: bruta } : (bruta ?? { texto: '' });
      const align = celula.align ?? col.align;
      const linhasTexto = (opcoes.quebrarTexto || linha.linhaLarga)
        ? doc.splitTextToSize(celula.texto ?? '', col.width - 4)
        : [celula.texto ?? ''];
      return { celula, align, linhasTexto };
    });
    const rowH = linha.altura
      ?? Math.max(alturaBase, Math.max(...textos.map(t => t.linhasTexto.length)) * 4 + 3);

    if (!flutuante && y + rowH > ctx.pageHeight - ctx.bottomReserve) {
      ctx.y = y; ctx.addPage(); y = ctx.y;
      desenharCabecalho();
    }

    const fundo = linha.fundo ?? (zebra ? (index % 2 === 0 ? C.light : C.white) : C.white);
    sf(fundo); doc.rect(x0, y, larguraTotal, rowH, 'F');
    if (linha.reguaSuperior) {
      sd(C.navy); doc.setLineWidth(0.35);
      doc.line(x0, y, x0 + larguraTotal, y);
    }
    sd(C.border); doc.setLineWidth(0.15);
    doc.line(x0, y + rowH, x0 + larguraTotal, y + rowH);

    textos.forEach((t, i) => {
      const cx = linha.linhaLarga ? x0 : colX[i];
      const largura = linha.linhaLarga ? larguraTotal : colunas[i].width;
      if (t.celula.fundo) { sf(t.celula.fundo); doc.rect(cx, y, largura, rowH, 'F'); }
      st(t.celula.cor ?? linha.cor ?? C.graphite);
      doc.setFont('helvetica', (t.celula.negrito ?? linha.negrito) ? 'bold' : 'normal');
      doc.setFontSize(t.celula.tamanho ?? fonte);
      const tx = linha.linhaLarga
        ? cx + 2
        : t.align === 'right' ? cx + largura - 2 : t.align === 'center' ? cx + largura / 2 : cx + 2;
      doc.text(t.linhasTexto, tx, y + 4.7, { align: linha.linhaLarga ? 'left' : alinhamentoJsPdf(t.align) });
    });
    y += rowH;
  });

  if (!flutuante) ctx.y = y;
  return y;
}

/** Régua, marca e paginação em todas as páginas. Chamar depois de tudo pronto. */
export function drawRodape(doc: jsPDF, emitidoEm: string, marginX = 14) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]); doc.setLineWidth(0.35);
    doc.line(marginX, pageHeight - 12.5, pageWidth - marginX, pageHeight - 12.5);
    doc.setTextColor(C.slate[0], C.slate[1], C.slate[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('PROVISION', marginX, pageHeight - 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('Sistema de Gestão Financeira e Projetos', marginX + 19, pageHeight - 8);
    doc.text(`Emitido em ${emitidoEm}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Página ${page} de ${pages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }
}

/** Normalização de nome de arquivo — a mesma desde o primeiro relatório. */
export function nomeSeguro(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}
