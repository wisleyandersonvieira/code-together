/**
 * Leitor de texto por página do PDF gerado, para os testes de enquadramento.
 *
 * Existe porque "nenhuma página com só uma nota" é uma afirmação sobre o
 * DOCUMENTO, não sobre o código que o desenha: contar `addPage` não prova nada,
 * e um teste que só olha o número de páginas não distingue uma página cheia de
 * uma página com uma frase.
 *
 * Não é um parser de PDF. O jsPDF escreve os streams SEM compressão e todo texto
 * sai como `(...) Tj`, então um autômato de parênteses sobre o stream da página
 * devolve exatamente o que foi impresso, na ordem em que foi impresso. Se um dia
 * o exportador ligar `compress: true`, este leitor devolve páginas vazias — e o
 * teste que depende dele falha alto, que é o que se quer.
 */

/** Desfaz o escape do PDF: `\(`, `\)`, `\\` e o octal `\ddd`. */
function desescapar(bruto: string): string {
  return bruto.replace(/\\([0-7]{1,3}|.)/g, (_, g: string) =>
    /^[0-7]{1,3}$/.test(g) ? String.fromCharCode(parseInt(g, 8)) : g,
  );
}

/** Os literais `(...)` de um stream, na ordem de impressão. */
function literaisDoStream(stream: string): string[] {
  const achados: string[] = [];
  let i = 0;
  while (i < stream.length) {
    if (stream[i] !== '(') { i++; continue; }
    let j = i + 1;
    let profundidade = 1;
    let bruto = '';
    while (j < stream.length && profundidade > 0) {
      const ch = stream[j];
      if (ch === '\\') { bruto += ch + (stream[j + 1] ?? ''); j += 2; continue; }
      if (ch === '(') profundidade++;
      else if (ch === ')') { profundidade--; if (profundidade === 0) break; }
      bruto += ch;
      j++;
    }
    // Só conta como texto o literal seguido de um operador de mostrar texto.
    if (/^\s*(Tj|TJ|'|")/.test(stream.slice(j + 1, j + 8))) achados.push(desescapar(bruto));
    i = j + 1;
  }
  return achados;
}

/**
 * Texto de cada página, em ordem. `paginas[0]` é a página 1.
 *
 * Recebe o PDF já serializado (`doc.output('arraybuffer')`), e não o `jsPDF`:
 * o que se quer auditar é o arquivo que o investidor abre.
 */
export function textoPorPagina(pdf: ArrayBuffer | Uint8Array): string[][] {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  let bruto = '';
  for (let i = 0; i < bytes.length; i++) bruto += String.fromCharCode(bytes[i]);

  const objetos = new Map<number, string>();
  const re = /(\d+) 0 obj\n([\s\S]*?)\nendobj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto)) !== null) objetos.set(Number(m[1]), m[2]);

  const paginas: { id: number; conteudo: number }[] = [];
  for (const [id, corpo] of objetos) {
    if (!corpo.includes('/Type /Page') || corpo.includes('/Type /Pages')) continue;
    const ref = /\/Contents (\d+) 0 R/.exec(corpo);
    if (ref) paginas.push({ id, conteudo: Number(ref[1]) });
  }
  // A ordem dos objetos de página é a ordem do documento: o jsPDF numera as
  // páginas na sequência em que as cria.
  paginas.sort((a, b) => a.id - b.id);

  return paginas.map(({ conteudo }) => {
    const corpo = objetos.get(conteudo) ?? '';
    const inicio = corpo.indexOf('stream\n');
    const fim = corpo.lastIndexOf('\nendstream');
    if (inicio < 0 || fim < 0) return [];
    return literaisDoStream(corpo.slice(inicio + 7, fim)).filter((t) => t.trim() !== '');
  });
}
