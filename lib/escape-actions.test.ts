import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { processTemplate, guardStatement } from '../supabase/functions/execute-sql/sql-template.ts';
import { sanitizeSearchParam } from './utils';

/**
 * O escape ponta a ponta, nas actions de verdade.
 *
 * Os testes de `sql-template.test.ts` cobrem os três caminhos de interpolação em
 * abstrato. Estes cobram o que o repositório de fato manda para o edge function:
 * a query REAL de cada action, com um valor que tem apóstrofo.
 *
 * O bug que os originou: o escape acontecia no shim E no edge function E, em
 * onze actions, uma terceira vez à mão dentro do próprio template.
 */

const RAIZ = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/** A query de uma action, lida do fonte — sem executar o módulo. */
function queryDaAction(arquivo: string): string {
  const fonte = readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const m = fonte.match(/query: `([\s\S]*?)`,\n/);
  if (!m) throw new Error(`Não achei a query em ${arquivo}`);
  return m[1];
}

/** Maior sequência de aspas seguidas: 2 é o certo, 4 é a corrupção. */
const maiorSequenciaDeAspas = (sql: string) =>
  Math.max(0, ...[...sql.matchAll(/'+/g)].map((m) => m[0].length));

describe('createCliente — nome com apóstrofo', () => {
  it("grava 'Sant''Ana': duas aspas, não quatro", () => {
    const gerada = processTemplate(queryDaAction('actions/createCliente.ts'), {
      name: "Sant'Ana",
      address: null,
      phone: null,
      email: null,
      cpf: null,
      fileUrls: [],
      active: true,
    });
    console.log('\n[1] createCliente:\n    ' + gerada.trim().replace(/\s+/g, ' '));
    expect(gerada).toContain(`'Sant''Ana'`);
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
  });
});

describe('updateConta — descrição com apóstrofo', () => {
  it("grava 'Owner''s Rep': duas aspas, não quatro", () => {
    const gerada = processTemplate(queryDaAction('actions/updateConta.ts'), {
      id: 3,
      nome: 'Conta',
      numero: '1',
      banco: 'X',
      descricao: "Owner's Rep",
      saldoInicial: 0,
      dataSaldoInicial: '2026-01-01',
      destaque: false,
    });
    console.log('\n[2] updateConta:\n    ' + gerada.trim().replace(/\s+/g, ' '));
    expect(gerada).toContain(`'Owner''s Rep'`);
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
  });
});

describe('textArrayExpr — o escape que FICA', () => {
  it("serializa ARRAY['Fase 1','D''Água']::text[] e o guard aceita", () => {
    // O escape do edge function só percorre strings de TOPO: o array chega lá
    // por referência e seus elementos passam intactos. Por isso — e só aqui — o
    // `.replace` manual continua sendo o certo.
    const expr = `SELECT 1 FROM t WHERE tags && {{ ${
      `"ARRAY[" + params.fases.map(s => "'" + String(s).replace(/'/g, "''") + "'").join(",") + "]::text[]"`
    } }}`;
    const gerada = processTemplate(expr, { fases: ['Fase 1', "D'Água"] });
    console.log('\n[3] textArrayExpr:\n    ' + gerada);
    expect(gerada).toContain(`ARRAY['Fase 1','D''Água']::text[]`);
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
    expect(guardStatement(gerada).ok).toBe(true);
  });

  it('o escape do edge function NÃO desce em array — é o que sustenta o acima', () => {
    // Se um dia descer, textArrayExpr tem de perder o `.replace` no mesmo commit.
    const gerada = processTemplate(`SELECT {{ params.lista.join("|") }}`, { lista: ["D'Água"] });
    expect(gerada).toBe(`SELECT D'Água`);
  });
});

describe('busca — sanitizeSearchParam mais o ramo ILIKE', () => {
  it("D'Angelo vira '%D''Angelo%': duas aspas", () => {
    const q = `SELECT 1 FROM f WHERE 1=1 {{ params && params.q ? "AND f.name ILIKE '%" + params.q + "%'" : "" }}`;
    const gerada = processTemplate(q, { q: sanitizeSearchParam("D'Angelo") });
    console.log('\n[4] busca ILIKE:\n    ' + gerada);
    expect(gerada).toContain(`ILIKE '%D''Angelo%'`);
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
    expect(guardStatement(gerada).ok).toBe(true);
  });

  it('sanitizeSearchParam não escapa aspas, mas ainda tira controle e barra', () => {
    expect(sanitizeSearchParam("D'Angelo")).toBe("D'Angelo");
    expect(sanitizeSearchParam('a\\b')).toBe('ab');
    expect(sanitizeSearchParam('a\x07b')).toBe('ab');
  });
});

describe('guarda — o escape manual não pode voltar', () => {
  it('nenhuma action escapa aspas à mão, exceto para elemento de ARRAY', () => {
    const dir = path.join(RAIZ, 'actions');
    const ofensores: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
      readFileSync(path.join(dir, f), 'utf8')
        .split('\n')
        .forEach((linha, i) => {
          if (!linha.includes("replace(/'/g")) return;
          // A ÚNICA exceção legítima: montar elemento de array. O escape do edge
          // function não desce em arrays — ver textArrayExpr em lib/sql-filters.
          if (linha.includes('ARRAY[') && linha.includes('.map(')) return;
          ofensores.push(`${f}:${i + 1}`);
        });
    }
    expect(
      ofensores,
      'Escape manual de aspas em action. O edge function já escapa no caminho ' +
        'certo (sql-template.ts): escapar de novo aqui dobra a aspa e corrompe o ' +
        'dado em silêncio. A única exceção é elemento de ARRAY.',
    ).toEqual([]);
  });

  it('sanitizeSearchParam e os filtros de status também não escapam', () => {
    for (const arq of ['lib/utils.ts', 'lib/sql-filters.ts']) {
      const linhas = readFileSync(path.join(RAIZ, arq), 'utf8').split('\n');
      const ofensores = linhas
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l }) => l.includes("replace(/'/g") && !l.includes('ARRAY['))
        .filter(({ l }) => !l.trimStart().startsWith('*'))
        .map(({ n }) => `${arq}:${n}`);
      expect(ofensores).toEqual([]);
    }
  });
});
