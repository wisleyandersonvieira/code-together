import { describe, expect, it } from 'vitest';
import { guardStatement, processTemplate, scrub } from './sql-template.ts';

/**
 * O escape de aspas do `execute-sql`.
 *
 * O bug que originou estes testes: o escape acontecia DUAS vezes — uma no shim
 * do cliente e outra aqui —, e todo texto com apóstrofo era gravado com a aspa
 * dobrada. `Owner's Rep` virava `Owner''s Rep`, e como o valor corrompido era
 * relido e reescapado, dobrava a cada salvamento: 1 → 2 → 4 → 8.
 *
 * Não aparecia em teste nenhum porque esta lógica morava dentro do `index.ts`,
 * que faz `Deno.serve` no topo e não é importável pelo vitest.
 */

/** O valor de referência do chamado: apóstrofo, acento, barra e aspas duplas. */
const VALOR = 'Sant\'Ana & Cia \\ "Fase 1"';

/** O que o Postgres ARMAZENA a partir do primeiro literal da query. */
function armazenado(sql: string): string {
  const m = sql.match(/'((?:[^']|'')*)'/);
  return m ? m[1].replace(/''/g, "'") : '(sem literal)';
}

/** Quantas aspas seguidas há na query gerada — 2 é certo, 4 é a corrupção. */
function maiorSequenciaDeAspas(sql: string): number {
  return Math.max(0, ...[...sql.matchAll(/'+/g)].map((m) => m[0].length));
}

describe('escape — ramo simples {{params.chave}}', () => {
  const query = `UPDATE modelagem_custos SET label = '{{params.label}}' WHERE id = {{params.id}}::int`;

  it('escapa a aspa UMA vez: duas na query gerada, não quatro', () => {
    const gerada = processTemplate(query, { label: VALOR, id: 7 });
    console.log('\n[1] ramo simples:\n    ' + gerada);
    expect(gerada).toContain(`'Sant''Ana & Cia \\ "Fase 1"'`);
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
    expect(armazenado(gerada)).toBe(VALOR);
  });

  it('número e booleano não viram literal, e nulo vira NULL', () => {
    expect(processTemplate(`x = {{params.n}}::int`, { n: 42 })).toBe('x = 42::int');
    expect(processTemplate(`x = {{params.b}}`, { b: true })).toBe('x = true');
    expect(processTemplate(`x = {{params.z}}::int`, { z: null })).toBe('x = NULL::int');
  });
});

describe('escape — ramo complexo SEM aspas (o fragmento é montado pela expressão)', () => {
  // A forma real de `countContasPagar`: o `{{…}}` não está entre aspas, e o
  // resultado volta CRU para dentro do SQL.
  const query =
    `SELECT COUNT(*) FROM contas_pagar cp JOIN fornecedores f ON cp.fornecedor_id = f.id ` +
    `WHERE 1 = 1 {{ params && params.q ? "AND f.name ILIKE '%" + params.q + "%'" : "" }}`;

  it('escapa a aspa UMA vez: duas na query gerada, não quatro', () => {
    const gerada = processTemplate(query, { q: VALOR });
    console.log('\n[2] ramo complexo sem aspas:\n    ' + gerada);
    expect(gerada).toContain(`ILIKE '%Sant''Ana & Cia \\ "Fase 1"%'`);
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
  });

  it('parâmetro ausente some do SQL, sem deixar fragmento pela metade', () => {
    expect(processTemplate(query, {})).toBe(
      `SELECT COUNT(*) FROM contas_pagar cp JOIN fornecedores f ON cp.fornecedor_id = f.id WHERE 1 = 1 `,
    );
  });
});

describe('escape — ramo complexo ENTRE aspas (o literal é montado pelo template)', () => {
  // A forma real de `updateContaPagar`. Aqui quem monta o literal é o
  // processTemplate, então a expressão recebe os params CRUS — mandar escapados
  // dobraria a aspa de novo, que é o caso que a correção inicial deixava passar.
  it('não escapa duas vezes quando o {{…}} está entre aspas', () => {
    const gerada = processTemplate(`SET numero = '{{params.numero || ''}}'`, { numero: VALOR });
    expect(maiorSequenciaDeAspas(gerada)).toBe(2);
    expect(armazenado(gerada)).toBe(VALOR);
  });

  it('valor vazio vira literal vazio, não NULL', () => {
    expect(processTemplate(`SET numero = '{{params.numero || ''}}'`, {})).toBe(`SET numero = ''`);
  });
});

describe('injeção', () => {
  const query =
    `SELECT COUNT(*) FROM contas_pagar cp JOIN fornecedores f ON cp.fornecedor_id = f.id ` +
    `WHERE 1 = 1 {{ params && params.q ? "AND f.name ILIKE '%" + params.q + "%'" : "" }}`;

  it("x' OR '1'='1 busca o TEXTO literal, não vira tautologia", () => {
    const gerada = processTemplate(query, { q: "x' OR '1'='1" });
    // A aspa do ataque foi neutralizada: tudo continua dentro de um literal só.
    expect(gerada).toContain(`ILIKE '%x'' OR ''1''=''1%'`);
    // Prova de que não escapou do literal: o scrub esvazia a query inteira até
    // o WHERE, e nada do ataque sobra como SQL.
    expect(scrub(gerada)).not.toMatch(/\bOR\b/);
    expect(guardStatement(gerada).ok).toBe(true);
  });

  it("x'; DELETE FROM users -- continua barrado pelo guardStatement", () => {
    const gerada = processTemplate(query, { q: "x'; DELETE FROM users --" });
    // Não vira dois statements: a aspa é escapada e o `;` fica DENTRO do literal.
    expect(scrub(gerada)).not.toContain(';');
    expect(guardStatement(gerada).ok).toBe(true);
    // E um `;` de verdade, fora de literal, continua sendo recusado.
    const encadeada = `SELECT 1; DELETE FROM users`;
    expect(guardStatement(encadeada)).toEqual({
      ok: false,
      reason: 'Múltiplos statements não são permitidos',
    });
  });
});

describe('guardStatement e scrub continuam em sincronia com os literais', () => {
  it('aceita as queries dos itens 1 e 2 já interpoladas', () => {
    const simples = processTemplate(
      `UPDATE modelagem_custos SET label = '{{params.label}}' WHERE id = {{params.id}}::int`,
      { label: VALOR, id: 7 },
    );
    const complexa = processTemplate(
      `SELECT COUNT(*) FROM contas_pagar cp JOIN fornecedores f ON cp.fornecedor_id = f.id ` +
        `WHERE 1 = 1 {{ params && params.q ? "AND f.name ILIKE '%" + params.q + "%'" : "" }}`,
      { q: VALOR },
    );
    expect(guardStatement(simples).ok).toBe(true);
    expect(guardStatement(complexa).ok).toBe(true);
  });

  it("trata '' como escape INTERNO do literal, e não como fim dele", () => {
    // Se o scrub perdesse o par `''`, tudo depois da aspa passaria a ser lido
    // como SQL — e um valor contendo "DROP" derrubaria a query por engano.
    expect(scrub(`SELECT 'a''b'`)).toBe(`SELECT ''`);
    expect(guardStatement(`SELECT 'contém a palavra DROP no texto'`).ok).toBe(true);
    // Fora do literal, a palavra continua barrada.
    expect(guardStatement(`SELECT 1 FROM t WHERE x = 1 DROP`).ok).toBe(false);
  });
});
