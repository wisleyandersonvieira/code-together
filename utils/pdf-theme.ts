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

/**
 * Caracteres de WinAnsi que moram na faixa 0x80–0x9F do CP1252. O resto da
 * tabela é ASCII (0x20–0x7E) mais Latin-1 (0xA0–0xFF), que dá para checar por
 * faixa; estes dezoito não, por isso a lista literal.
 */
const WINANSI_ALTO = new Set('\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178');

/** Substituições explícitas: o que o relatório escreve e a tabela não tem. */
const SUBSTITUICOES_WINANSI: Record<string, string> = {
  '\u2212': '-',    // MINUS SIGN — o "Capital − pagamentos" que virou aspas
  '\u2010': '-',    // HYPHEN
  '\u2011': '-',    // NON-BREAKING HYPHEN
  '\u2260': '!=',
  '\u2265': '>=',
  '\u2264': '<=',
  '\u2248': '~=',
  '\u00b1': '+/-',
  '\u00d7': 'x',
  '\u2044': '/',
  '\u2026': '...',
  '\u2192': '->',
  '\u2190': '<-',
  '\u2009': ' ',    // THIN SPACE
  '\u200a': ' ',    // HAIR SPACE
  '\u2007': ' ',    // FIGURE SPACE
  '\u2008': ' ',    // PUNCTUATION SPACE
  '\u202f': ' ',    // NARROW NO-BREAK SPACE
  '\u00a0': ' ',    // NO-BREAK SPACE
  '\u200b': '',     // ZERO WIDTH SPACE
  '\u00ad': '',     // SOFT HYPHEN
  '\u201c': '"',
  '\u201d': '"',
  '\u201e': '"',
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': "'",
};

const representavelEmWinAnsi = (ch: string): boolean => {
  const cp = ch.charCodeAt(0);
  if (cp === 0x0a || cp === 0x09) return true;
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xa0 && cp <= 0xff) return true;
  return WINANSI_ALTO.has(ch);
};

/**
 * Sanitiza texto para WinAnsiEncoding, a tabela das fontes padrão do jsPDF.
 * Caractere fora dela sai como lixo silencioso — foi o que aconteceu com
 * U+2212 (MINUS SIGN), que virou aspas no relatório.
 * Embutir uma fonte TTF resolveria de vez, mas custa 300 KB+ no bundle e não
 * se justifica para meia dúzia de símbolos.
 *
 * O que sobra depois do mapa perde o acento (NFD sem as combinantes) e, se
 * ainda assim não couber na tabela, vira '?'. Um '?' visível é reportável; o
 * lixo silencioso não era.
 */
export function textoPdf(s: string): string {
  if (!s) return s === '' ? '' : String(s ?? '');
  let saida = '';
  for (const ch of String(s)) {
    const trocado = SUBSTITUICOES_WINANSI[ch];
    if (trocado !== undefined) { saida += trocado; continue; }
    if (representavelEmWinAnsi(ch)) { saida += ch; continue; }
    const semAcento = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    saida += semAcento && [...semAcento].every(representavelEmWinAnsi) ? semAcento : '?';
  }
  return saida;
}

/** `textoPdf` sobre um array — a forma que `splitTextToSize` devolve. */
const textosPdf = (linhas: string[]): string[] => linhas.map(textoPdf);

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
  doc.text(textoPdf('PROVISION'), marginX + 28, ctx.y + 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(textoPdf(o.eyebrow ?? 'Relatório Financeiro'), pageWidth - marginX - 4, ctx.y + 8, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(textoPdf(o.titulo), marginX + 28, ctx.y + 18);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.text(textoPdf(o.subtitulo), marginX + 28, ctx.y + 25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(textoPdf(`Emitido em ${o.emitidoEm}`), marginX + 28, ctx.y + 30);
  sf(C.white); doc.roundedRect(pageWidth - marginX - 42, ctx.y + 21, 38, 8, 3, 3, 'F');
  st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text(textoPdf(o.badge), pageWidth - marginX - 23, ctx.y + 26.2, { align: 'center' });
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
    doc.text(textoPdf(eyebrow.toUpperCase()), marginX, ctx.y);
    ctx.y += 4;
  }
  if (modo !== 'eyebrow' && titulo) {
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(textoPdf(titulo), marginX, ctx.y);
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
    rowHeights.push(par.reduce((rh, item) => Math.max(rh, 10 + doc.splitTextToSize(textoPdf(item.value), colWidth - 8).length * 4.2), 16));
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
    doc.text(textoPdf(item.label.toUpperCase()), x + 4, localY + 5);
    st(C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(textosPdf(doc.splitTextToSize(textoPdf(item.value), colWidth - 8)), x + 4, localY + 10.5);
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
    doc.text(textoPdf(card.label.toUpperCase()), cx + 4, localY + 7);
    st(palette.text); doc.setFont('helvetica', 'bold'); doc.setFontSize(tamanhoValor);
    doc.text(textosPdf(doc.splitTextToSize(textoPdf(card.value), cardWidth - 8)), cx + 4, localY + 14);
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
  const rotulo = textoPdf(texto);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(tamanho);
  const largura = opcoes.largura ?? doc.getTextWidth(rotulo) + 4;
  sf(opcoes.fundo ?? palette.bg);
  doc.roundedRect(x, y, largura, 5, 2, 2, 'F');
  st(opcoes.cor ?? palette.text);
  doc.text(rotulo, x + largura / 2, y + 3.7, { align: 'center' });
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
  /** Custo sem descrição, nota de rodapé — o que é dito e não é dado. */
  italico?: boolean;
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

/** Altura de uma linha de texto do jsPDF, em mm — 1,15 é o fator padrão. */
const alturaLinhaTexto = (fonte: number) => (fonte * 1.15 * 25.4) / 72;

/** Passos de redução de fonte antes de deixar estourar. Dois, e só. */
const PASSOS_REDUCAO = [0, 0.5, 1];

interface CelulaMedida {
  celula: CelulaTabela;
  align: AlinhamentoColuna | undefined;
  linhasTexto: string[];
  tamanho: number;
}

/**
 * Tabela do sistema: header navy, zebra clara, header repetido a cada página.
 * Devolve o `y` final (igual a `ctx.y` no modo normal).
 *
 * Texto NUNCA é cortado. A ordem é: quebrar em várias linhas (default), depois
 * reduzir a fonte em 0,5 pt por passo, no máximo dois; o que ainda estourar
 * estoura à vista. Layout feio o usuário reporta — dado escondido, não.
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
  const fonteBase = opcoes.tamanhoFonte ?? 7.5;
  const fonteCabBase = opcoes.tamanhoCabecalho ?? 7.5;
  const alturaCabBase = opcoes.alturaCabecalho ?? 8;
  const alturaBase = opcoes.alturaLinha ?? 7;
  const zebra = opcoes.zebra ?? true;
  // Quebrar é o DEFAULT: cabeçalho e célula truncados eram o defeito mais
  // reportado do relatório, e nenhuma tabela quer perder texto.
  const quebrar = opcoes.quebrarTexto ?? true;
  const larguraTotal = colunas.reduce((a, c) => a + c.width, 0);

  const colX: number[] = [];
  let rx = x0;
  colunas.forEach(c => { colX.push(rx); rx += c.width; });

  /**
   * Mede uma célula com a fonte que ela vai usar de fato. Medir antes de
   * `setFontSize` — o que o código fazia — quebrava o texto pela fonte da
   * célula anterior, e era daí que vinha o estouro.
   */
  const estilo = (negrito: boolean, italico: boolean) =>
    negrito ? (italico ? 'bolditalic' : 'bold') : (italico ? 'italic' : 'normal');

  const medir = (texto: string, fonte: number, negrito: boolean, largura: number, quebrarAqui: boolean, italico = false) => {
    doc.setFont('helvetica', estilo(negrito, italico));
    doc.setFontSize(fonte);
    const limpo = textoPdf(texto ?? '');
    const linhasTexto: string[] = quebrarAqui
      ? (doc.splitTextToSize(limpo, Math.max(1, largura)) as string[])
      : limpo.split('\n');
    // Duas formas de não caber. A linha que estoura é a óbvia; a outra é a
    // PALAVRA que não cabe sozinha — aí o `splitTextToSize` quebra no meio dela
    // ('Participaçã' / 'o') e o estouro fica escondido atrás de um corte pior.
    const excedente = Math.max(
      0,
      ...linhasTexto.map(l => doc.getTextWidth(l) - largura),
      ...limpo.split(/\s+/).map(palavra => doc.getTextWidth(palavra) - largura),
    );
    return { linhasTexto, excedente };
  };

  /** Mede a tabela inteira com a fonte reduzida em `reducao` pt. */
  const preparar = (reducao: number) => {
    const fonteCab = Math.max(4, fonteCabBase - reducao);
    let estouro = false;

    const cabecalho = colunas.map((col) => {
      // O `\n` do rótulo é quebra declarada pelo chamador; o resto é medido.
      const partes = String(col.label ?? '').split('\n');
      const linhasTexto: string[] = [];
      for (const parte of partes) {
        const m = medir(parte, fonteCab, true, col.width - 4, true);
        linhasTexto.push(...m.linhasTexto);
        if (m.excedente > 0.05) estouro = true;
      }
      return linhasTexto;
    });

    const corpo = linhas.map((linha) => {
      const colunasDaLinha = linha.linhaLarga
        ? [{ label: '', width: larguraTotal, align: 'left' as const }]
        : colunas;
      const celulas: CelulaMedida[] = colunasDaLinha.map((col, i) => {
        const bruta = linha.celulas[i];
        const celula: CelulaTabela = typeof bruta === 'string' ? { texto: bruta } : (bruta ?? { texto: '' });
        const align = celula.align ?? col.align;
        const tamanho = Math.max(4, (celula.tamanho ?? fonteBase) - reducao);
        const negrito = !!(celula.negrito ?? linha.negrito);
        const m = medir(celula.texto ?? '', tamanho, negrito, col.width - 4, quebrar || !!linha.linhaLarga, !!celula.italico);
        if (m.excedente > 0.05) estouro = true;
        return { celula, align, linhasTexto: m.linhasTexto, tamanho };
      });
      // A altura da linha é a da célula MAIS ALTA, não a da primeira coluna.
      const maxLinhas = Math.max(1, ...celulas.map(c => c.linhasTexto.length));
      const alturaConteudo = maxLinhas * 4 + 3;
      const rowH = maxLinhas > 1
        ? Math.max(linha.altura ?? alturaBase, alturaConteudo)
        : (linha.altura ?? Math.max(alturaBase, alturaConteudo));
      return { linha, celulas, rowH };
    });

    const nCab = Math.max(1, ...cabecalho.map(l => l.length));
    const alturaCab = Math.max(alturaCabBase, nCab * alturaLinhaTexto(fonteCab) + 3);
    return { fonteCab, cabecalho, corpo, alturaCab, nCab, estouro };
  };

  let medida = preparar(PASSOS_REDUCAO[0]);
  for (let passo = 1; passo < PASSOS_REDUCAO.length && medida.estouro; passo++) {
    medida = preparar(PASSOS_REDUCAO[passo]);
  }

  const { fonteCab, cabecalho, corpo, alturaCab, nCab } = medida;

  const posX = (i: number, align: AlinhamentoColuna | undefined) =>
    align === 'right' ? colX[i] + colunas[i].width - 2
      : align === 'center' ? colX[i] + colunas[i].width / 2
        : colX[i] + 2;

  let y = flutuante ? (opcoes.y as number) : ctx.y;

  const desenharCabecalho = () => {
    sf(C.navy); doc.rect(x0, y, larguraTotal, alturaCab, 'F');
    st(C.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(fonteCab);
    const lh = alturaLinhaTexto(fonteCab);
    // Uma linha só: a base histórica. Várias: o bloco centraliza na faixa.
    const base = nCab === 1 ? y + alturaCab / 2 + 1.4 : y + (alturaCab - nCab * lh) / 2 + lh * 0.78;
    colunas.forEach((col, i) => {
      doc.text(cabecalho[i], posX(i, col.align), base, { align: alinhamentoJsPdf(col.align) });
    });
    y += alturaCab;
  };

  if (!flutuante) {
    ctx.ensureSpace(alturaCab + (corpo[0]?.rowH ?? alturaBase));
    y = ctx.y;
  }
  desenharCabecalho();

  corpo.forEach(({ linha, celulas, rowH }, index) => {
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

    celulas.forEach((t, i) => {
      const cx = linha.linhaLarga ? x0 : colX[i];
      const largura = linha.linhaLarga ? larguraTotal : colunas[i].width;
      if (t.celula.fundo) { sf(t.celula.fundo); doc.rect(cx, y, largura, rowH, 'F'); }
      st(t.celula.cor ?? linha.cor ?? C.graphite);
      doc.setFont('helvetica', estilo(!!(t.celula.negrito ?? linha.negrito), !!t.celula.italico));
      doc.setFontSize(t.tamanho);
      const tx = linha.linhaLarga
        ? cx + 2
        : t.align === 'right' ? cx + largura - 2 : t.align === 'center' ? cx + largura / 2 : cx + 2;
      // 4,7 mm é a base histórica e vale para toda linha de altura normal. Numa
      // linha baixa — as do anexo, que precisam caber 30 linhas numa página — a
      // base desce junto, senão o texto vaza por baixo da própria linha.
      const base = Math.min(4.7, Math.max(2.6, rowH - 1.5));
      doc.text(t.linhasTexto, tx, y + base, { align: linha.linhaLarga ? 'left' : alinhamentoJsPdf(t.align) });
    });
    y += rowH;
  });

  if (!flutuante) ctx.y = y;
  return y;
}

export interface OpcoesRodape {
  /** Substitui 'Sistema de Gestão Financeira e Projetos' ao lado da marca. */
  legenda?: string;
  /**
   * Nome da seção que a página está mostrando, 1-based. Entra antes da data,
   * no centro — é o que faz o rodapé dizer onde o leitor está.
   */
  secaoDaPagina?: (pagina: number) => string | undefined;
}

/** Régua, marca e paginação em todas as páginas. Chamar depois de tudo pronto. */
export function drawRodape(doc: jsPDF, emitidoEm: string, marginX = 14, rodape?: OpcoesRodape) {
  const pages = doc.getNumberOfPages();
  const centro = (page: number) => {
    const secao = rodape?.secaoDaPagina?.(page);
    return secao ? `${secao} · Emitido em ${emitidoEm}` : `Emitido em ${emitidoEm}`;
  };
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]); doc.setLineWidth(0.35);
    doc.line(marginX, pageHeight - 12.5, pageWidth - marginX, pageHeight - 12.5);
    doc.setTextColor(C.slate[0], C.slate[1], C.slate[2]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(textoPdf('PROVISION'), marginX, pageHeight - 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(textoPdf(rodape?.legenda ?? 'Sistema de Gestão Financeira e Projetos'), marginX + 19, pageHeight - 8);
    doc.text(textoPdf(centro(page)), pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(textoPdf(`Página ${page} de ${pages}`), pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }
}

/** Normalização de nome de arquivo — a mesma desde o primeiro relatório. */
export function nomeSeguro(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}
