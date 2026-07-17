/**
 * Helpers para montar fragmentos de SQL com filtros por lista de ids.
 *
 * Os fragmentos retornados são expressões de template UIBakery que a edge
 * function `execute-sql` avalia com `new Function("params", ...)`. Por isso a
 * expressão só pode referenciar `params` e usar JS padrão — nada deste módulo
 * está disponível em tempo de avaliação; o helper apenas *monta o texto* da
 * expressão em tempo de import.
 *
 * Segurança: `sanitiseParams` (lib/uibakery-shim.ts) só escapa strings, então
 * arrays chegam crus na edge function. O `.map(Number).filter(...)` dentro da
 * expressão garante que apenas números finitos entrem no SQL — qualquer valor
 * não numérico vira NaN e é descartado, tornando a injeção impossível.
 * Lista vazia gera `ANY(ARRAY[]::int[])`, que é válido e não casa com nada.
 */

/** Expressão JS (avaliada na edge function) que serializa params[param] em ints. */
function intArrayExpr(param: string): string {
  return `"ARRAY[" + params.${param}.map(Number).filter(n => !isNaN(n)).join(",") + "]::int[]"`;
}

/**
 * `AND <column> = ANY(ARRAY[...]::int[])` quando params[param] tem itens;
 * string vazia caso contrário (= sem filtro).
 */
export function andIdIn(column: string, param: string): string {
  return `{{ params.${param} && params.${param}.length ? "AND ${column} = ANY(" + ${intArrayExpr(param)} + ")" : "" }}`;
}

/**
 * Idem, porém só aplica quando `params.tipoData === 'pagamento'`.
 * Usado no filtro de conta corrente do DRE, que só faz sentido na emissão por
 * data de pagamento (no critério de competência o título pode não ter conta).
 */
export function andIdInWhenPagamento(column: string, param: string): string {
  return `{{ params.tipoData === 'pagamento' && params.${param} && params.${param}.length ? "AND ${column} = ANY(" + ${intArrayExpr(param)} + ")" : "" }}`;
}

/** Coage um valor vindo da UI para uma lista de ids numéricos válidos. */
export function toIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
}
