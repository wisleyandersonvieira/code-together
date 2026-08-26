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

/**
 * Expressão JS (avaliada na edge function) que serializa params[param] numa
 * lista de literais de texto SQL. Cada elemento é envolvido em aspas simples e
 * tem suas aspas internas duplicadas — o `sanitiseParams` do shim só escapa
 * strings de topo, então elementos de array precisam ser escapados aqui.
 * Lista vazia gera `ARRAY[]::text[]`, válido e que não casa com nada.
 */
function textArrayExpr(param: string): string {
  return `"ARRAY[" + params.${param}.map(s => "'" + String(s).replace(/'/g, "''") + "'").join(",") + "]::text[]"`;
}

/**
 * Fator de rateio por status do projeto, para MULTIPLICAR o valor de um item do
 * DRE. Retorna um fragmento que se anexa logo após a expressão de valor.
 *
 * - `params[param]` vazio/ausente → string vazia: o SQL sai IDÊNTICO ao atual,
 *   sem qualquer multiplicação (regressão total do DRE existente).
 * - `params[param]` com itens → ` * (CASE ... END)` com o fator:
 *     • conta SEM vínculo de projeto (NOT EXISTS) → fator 1.0 (valor integral,
 *       sempre exibido);
 *     • conta COM vínculo, fração no status = X%   → fator X/100 (parte rateada);
 *     • conta COM vínculo, nada no status          → fator 0 (excluída).
 *
 * A distinção "sem vínculo (1)" × "fora do status (0)" usa EXISTS, e não um
 * simples COALESCE do SUM: `SUM(...)` sobre zero linhas devolve NULL, que cairia
 * no ramo sem-vínculo por engano. O EXISTS resolve o "tem vínculo?" antes; o
 * COALESCE interno cobre só o caso "tem vínculo, mas nenhum projeto no status".
 *
 * Segue o mesmo padrão de template de {@link andIdIn}: a expressão só referencia
 * `params` e é avaliada na edge function; aqui apenas montamos o texto.
 *
 * @param contaCol      coluna da conta na query externa (ex.: 'cp.id')
 * @param tabelaRateio  tabela N:N conta↔projeto (ex.: 'contas_pagar_projetos')
 * @param fkCol         FK da conta na tabela de rateio (ex.: 'conta_pagar_id')
 * @param param         nome do parâmetro com a lista de status (default statusProjeto)
 */
export function fatorRateioStatus(
  contaCol: string,
  tabelaRateio: string,
  fkCol: string,
  param = 'statusProjeto',
): string {
  const fatorSql =
    `" * (CASE WHEN NOT EXISTS (SELECT 1 FROM ${tabelaRateio} r WHERE r.${fkCol} = ${contaCol}) THEN 1.0 ` +
    `ELSE COALESCE((SELECT SUM(r.percentual) / 100.0 FROM ${tabelaRateio} r ` +
    `JOIN projetos pr ON pr.id = r.projeto_id ` +
    `WHERE r.${fkCol} = ${contaCol} AND pr.status = ANY(" + ${textArrayExpr(param)} + ")), 0) END)"`;
  return `{{ params.${param} && params.${param}.length ? ${fatorSql} : "" }}`;
}

/**
 * `AND EXISTS (... tabela de rateio ... AND projeto_id = ANY(ARRAY[...]))`
 * quando `params[param]` tem itens; string vazia caso contrário.
 */
export function andProjetoIdIn(
  contaCol: string,
  tabelaRateio: string,
  fkCol: string,
  param = 'projetoIds',
): string {
  const sql =
    `"AND EXISTS (SELECT 1 FROM ${tabelaRateio} rp WHERE rp.${fkCol} = ${contaCol} ` +
    `AND rp.projeto_id = ANY(" + ${intArrayExpr(param)} + "))"`;
  return `{{ params.${param} && params.${param}.length ? ${sql} : "" }}`;
}

/**
 * Filtro por status de projeto que EXIGE vínculo com projeto:
 * - `params[param]` vazio/ausente → sem filtro (SQL idêntico ao atual);
 * - `params[param] === 'todos'`   → apenas lançamentos com projeto vinculado;
 * - qualquer outro valor          → projeto vinculado com aquele status.
 */
export function andProjetoStatus(
  contaCol: string,
  tabelaRateio: string,
  fkCol: string,
  param = 'statusProjeto',
): string {
  const statusSql =
    `(params.${param} === 'todos' ? "" : " AND ps.status = '" + String(params.${param}).replace(/'/g, "''") + "'")`;
  const sql =
    `"AND EXISTS (SELECT 1 FROM ${tabelaRateio} rs JOIN projetos ps ON ps.id = rs.projeto_id ` +
    `WHERE rs.${fkCol} = ${contaCol}" + ${statusSql} + ")"`;
  return `{{ params.${param} ? ${sql} : "" }}`;
}
