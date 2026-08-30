/**
 * Coerção numérica dos valores que chegam do Postgres.
 *
 * `DECIMAL`/`NUMERIC` e `bigint` (o retorno de `COUNT`) podem chegar como
 * string dependendo do driver e do caminho que o JSON percorre. Somar string em
 * JavaScript concatena — `"100" + "23"` é `"10023"`, não `123` — e o erro
 * aparece como um total absurdo, não como exceção. É o mesmo cuidado que
 * `lib/modelagem/mapear.ts` documenta.
 *
 * Nada aqui inventa valor: entrada inválida vira `null`, e quem chama decide se
 * isso é zero de verdade ou ausência de dado.
 */

/** Devolve `null` para ausente/inválido — preserva a diferença entre 0 e vazio. */
export function numeroSqlOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor));
  return Number.isFinite(n) ? n : null;
}

/** Para somas e comparações, onde ausência é legitimamente zero. */
export function numeroSql(valor: unknown): number {
  return numeroSqlOuNulo(valor) ?? 0;
}

/** Contagem inteira. Ausente vira `null` — "não sei" não é "zero". */
export function inteiroSqlOuNulo(valor: unknown): number | null {
  const n = numeroSqlOuNulo(valor);
  return n === null ? null : Math.trunc(n);
}
