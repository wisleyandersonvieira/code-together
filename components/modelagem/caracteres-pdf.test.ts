/**
 * Guarda de caracteres dos relatórios PDF.
 *
 * O jsPDF com as fontes padrão (Helvetica) escreve em WinAnsiEncoding.
 * Caractere fora dessa tabela não estoura: sai como lixo silencioso — foi o
 * que aconteceu com U+2212 (MINUS SIGN), que virou aspas no meio do relatório
 * e ninguém percebeu por meses.
 *
 * `textoPdf` conserta no cano, mas quem escreve um `−` na fonte continua
 * escrevendo algo que não é o que quis dizer. Este teste varre os LITERAIS de
 * string dos exportadores e reprova o que não estiver na whitelist. Comentário
 * fica de fora de propósito: `─`, `→` e `≥` são legítimos em prosa de código.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { textoPdf } from '@/utils/pdf-theme';

const DIRETORIO = fileURLToPath(new URL('.', import.meta.url));

/** Faixa 0x80–0x9F do CP1252 — o pedaço de WinAnsi que não é ASCII nem Latin-1. */
const WINANSI_ALTO = new Set(
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ' +
  '‘’“”•–—˜™š›œžŸ',
);

/**
 * Invisíveis que a tabela até representa, mas que ninguém digita de propósito:
 * um espaço inquebrável no meio de um rótulo é indistinguível de um espaço
 * comum na revisão e vira bug de alinhamento no dia seguinte.
 */
const PROIBIDOS_INVISIVEIS = new Set(' ­');

function permitido(ch: string): boolean {
  if (PROIBIDOS_INVISIVEIS.has(ch)) return false;
  const cp = ch.charCodeAt(0);
  if (cp === 0x0a || cp === 0x09) return true;
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xa0 && cp <= 0xff) return true;
  return WINANSI_ALTO.has(ch);
}

interface Literal { linha: number; texto: string }

/**
 * Extrai os literais de string do fonte, ignorando comentários.
 *
 * Não é um parser de TypeScript: é um autômato de aspas, barras e `${`, que é
 * exatamente o que precisa distinguir um rótulo de um comentário.
 */
function literaisDeString(fonte: string): Literal[] {
  const achados: Literal[] = [];
  const pilha: string[] = [];
  let atual: string | null = null;
  let inicioLinha = 1;
  let acumulado = '';
  let linha = 1;
  let i = 0;

  const abrir = (aspas: string) => { atual = aspas; acumulado = ''; inicioLinha = linha; };
  const fechar = () => {
    if (atual !== null) achados.push({ linha: inicioLinha, texto: acumulado });
    atual = null;
  };

  while (i < fonte.length) {
    const ch = fonte[i];
    const prox = fonte[i + 1];
    if (ch === '\n') linha++;

    if (atual === null) {
      if (ch === '/' && prox === '/') {
        while (i < fonte.length && fonte[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && prox === '*') {
        i += 2;
        while (i < fonte.length && !(fonte[i] === '*' && fonte[i + 1] === '/')) {
          if (fonte[i] === '\n') linha++;
          i++;
        }
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { abrir(ch); i++; continue; }
      // Fim de uma interpolação `${…}`: volta para o template que a abriu.
      if (ch === '}' && pilha.length > 0) { abrir(pilha.pop() as string); i++; continue; }
      i++;
      continue;
    }

    if (ch === '\\') { acumulado += fonte[i + 1] ?? ''; i += 2; continue; }
    if (ch === atual) { fechar(); i++; continue; }
    if (atual === '`' && ch === '$' && prox === '{') {
      fechar();
      pilha.push('`');
      i += 2;
      continue;
    }
    acumulado += ch;
    i++;
  }
  fechar();
  return achados;
}

const ARQUIVOS = readdirSync(DIRETORIO)
  .filter((f) => /^exportarPdf.*\.ts$/.test(f) && !f.endsWith('.test.ts'))
  .sort();

describe('literais dos exportadores de PDF', () => {
  it('encontra os exportadores', () => {
    expect(ARQUIVOS.length).toBeGreaterThan(0);
  });

  for (const arquivo of ARQUIVOS) {
    it(`${arquivo} só usa caracteres de WinAnsiEncoding`, () => {
      const fonte = readFileSync(path.join(DIRETORIO, arquivo), 'utf-8');
      const infratores = literaisDeString(fonte)
        .flatMap((lit) =>
          [...lit.texto]
            .filter((ch) => !permitido(ch))
            .map((ch) => `${arquivo}:${lit.linha} — U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} (${ch})`),
        );
      expect([...new Set(infratores)]).toEqual([]);
    });
  }
});

describe('textoPdf', () => {
  it('troca os símbolos que WinAnsi não tem', () => {
    expect(textoPdf('Capital − pagamentos')).toBe('Capital - pagamentos');
    expect(textoPdf('a ≠ b')).toBe('a != b');
    expect(textoPdf('a ≥ b')).toBe('a >= b');
    expect(textoPdf('a ≤ b')).toBe('a <= b');
    expect(textoPdf('3 × 4')).toBe('3 x 4');
    expect(textoPdf('etc…')).toBe('etc...');
    expect(textoPdf('a → b')).toBe('a -> b');
    expect(textoPdf('a b c')).toBe('a b c');
    expect(textoPdf('“x” e ‘y’')).toBe('"x" e \'y\'');
    expect(textoPdf('n‑1')).toBe('n-1');
  });

  it('preserva o que a tabela tem — travessão, acento e cifrão', () => {
    expect(textoPdf('Apuração — R$ 1.000 · 50%')).toBe('Apuração — R$ 1.000 · 50%');
  });

  it('não devolve caractere fora da tabela nem para entrada exótica', () => {
    const saida = textoPdf('Sócio 中文 क');
    expect([...saida].every(permitido)).toBe(true);
  });
});
