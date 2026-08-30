/**
 * Coerção numérica de valor vindo do Postgres.
 *
 * DECIMAL/NUMERIC não chega necessariamente como number: dependendo do driver e
 * do caminho (`json_build_object`, `row_to_json`, o edge function no meio), o
 * valor vem como string. Somar string em JS concatena em silêncio — "100" +
 * "200" vira "100200" e ninguém acusa. É o mesmo cuidado que
 * `lib/modelagem/mapear.ts` documenta, e vale aqui igual.
 */
export function numeroSql(valor: unknown): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'string') {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Igual, mas preserva a ausência: `null`/`undefined`/'' continuam `null`.
 *
 * Use onde "não existe" e "é zero" são coisas diferentes — um saldo zero é um
 * dado, uma conta sem saldo lançado não é.
 */
export function numeroSqlOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Percentuais inteiros que somam exatamente 100 (maior resto).
 *
 * Arredondar cada fatia isolada produz 99% ou 101% no rodapé de um donut, e é
 * o tipo de erro que o usuário enxerga na hora. Total zero devolve zeros.
 */
export function percentuaisInteiros(valores: number[]): number[] {
  const total = valores.reduce((a, v) => a + v, 0);
  if (total <= 0) return valores.map(() => 0);

  const exatos = valores.map((v) => (v / total) * 100);
  const pisos = exatos.map(Math.floor);
  let sobra = 100 - pisos.reduce((a, v) => a + v, 0);

  const ordem = exatos
    .map((valor, indice) => ({ indice, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto);

  const saida = [...pisos];
  for (const { indice } of ordem) {
    if (sobra <= 0) break;
    saida[indice] += 1;
    sobra -= 1;
  }
  return saida;
}
