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
 * tem suas aspas internas duplicadas.
 *
 * ESTE `.replace` FICA, e é a única exceção do repositório — todos os outros
 * foram removidos junto com o escape duplo. O escape do edge function percorre
 * só as strings de TOPO de `params`: um array chega lá por referência e seus
 * elementos passam intactos. Então quem escapa elemento de array é quem o
 * serializa, que é esta função.
 *
 * Se um dia o escape do edge function passar a descer em arrays, os dois mudam
 * JUNTOS — tirar um sem o outro corrompe (dois escapes) ou abre injeção
 * (nenhum). Ver supabase/functions/execute-sql/sql-template.ts.
 *
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
    `(params.${param} === 'todos' ? "" : " AND ps.status = '" + String(params.${param}) + "'")`;
  const sql =
    `"AND EXISTS (SELECT 1 FROM ${tabelaRateio} rs JOIN projetos ps ON ps.id = rs.projeto_id ` +
    `WHERE rs.${fkCol} = ${contaCol}" + ${statusSql} + ")"`;
  return `{{ params.${param} ? ${sql} : "" }}`;
}

/**
 * Colunas de fração por status de projeto, usadas pelo modo "Separar colunas"
 * do DRE Info. Sempre presentes (SQL estático, sem params):
 * - frac_geral: 1 quando a conta NÃO tem projeto vinculado, senão 0
 * - frac_andamento / frac_concluido: soma do percentual rateado no status / 100
 */
export function fracoesStatusProjeto(
  contaCol: string,
  tabelaRateio: string,
  fkCol: string,
): string {
  const soma = (status: string) =>
    `COALESCE((SELECT SUM(fr.percentual) / 100.0 FROM ${tabelaRateio} fr ` +
    `JOIN projetos fp ON fp.id = fr.projeto_id ` +
    `WHERE fr.${fkCol} = ${contaCol} AND fp.status = '${status}'), 0)`;
  return `
        CASE WHEN NOT EXISTS (SELECT 1 FROM ${tabelaRateio} fg WHERE fg.${fkCol} = ${contaCol}) THEN 1.0 ELSE 0 END as frac_geral,
        ${soma('Em andamento')} as frac_andamento,
        ${soma('Concluído')} as frac_concluido,`;
}

/* -------------------------------------------------------------------------
 * Contas a receber: o vínculo com projeto pode vir de DUAS tabelas:
 *  - contas_receber_projetos     → rateio por PERCENTUAL
 *  - contas_receber_faturamento  → faturamento por projeto, em VALOR absoluto
 * Os helpers abaixo consideram as duas fontes (a fração do faturamento é
 * valor_faturamento / valor_total da conta).
 * ---------------------------------------------------------------------- */

const CRP = 'contas_receber_projetos';
const CRF = 'contas_receber_faturamento';

/** Existe algum vínculo de projeto (rateio ou faturamento) para a conta. */
function crExisteVinculo(contaCol: string): string {
  return (
    `(EXISTS (SELECT 1 FROM ${CRP} vp WHERE vp.conta_receber_id = ${contaCol}) ` +
    `OR EXISTS (SELECT 1 FROM ${CRF} vf WHERE vf.conta_receber_id = ${contaCol}))`
  );
}

/** Fração (0..1) da conta vinculada a projetos com o status informado. */
function crFracaoStatus(contaCol: string, valorTotalCol: string, statusSql: string): string {
  return (
    `(COALESCE((SELECT SUM(rp.percentual) / 100.0 FROM ${CRP} rp ` +
    `JOIN projetos pp ON pp.id = rp.projeto_id ` +
    `WHERE rp.conta_receber_id = ${contaCol} AND pp.status = ${statusSql}), 0) ` +
    `+ COALESCE((SELECT SUM(rf.valor_faturamento) / NULLIF(${valorTotalCol}, 0) FROM ${CRF} rf ` +
    `JOIN projetos pf ON pf.id = rf.projeto_id ` +
    `WHERE rf.conta_receber_id = ${contaCol} AND pf.status = ${statusSql}), 0))`
  );
}

/** Colunas frac_geral / frac_andamento / frac_concluido para contas a receber. */
export function fracoesStatusProjetoReceber(contaCol: string, valorTotalCol: string): string {
  return `
        CASE WHEN NOT ${crExisteVinculo(contaCol)} THEN 1.0 ELSE 0 END as frac_geral,
        ${crFracaoStatus(contaCol, valorTotalCol, `'Em andamento'`)} as frac_andamento,
        ${crFracaoStatus(contaCol, valorTotalCol, `'Concluído'`)} as frac_concluido,`;
}

/** Filtro por lista de projetos (rateio ou faturamento). */
export function andProjetoIdInReceber(contaCol: string, param = 'projetoIds'): string {
  const sql =
    `"AND (EXISTS (SELECT 1 FROM ${CRP} fp1 WHERE fp1.conta_receber_id = ${contaCol} ` +
    `AND fp1.projeto_id = ANY(" + ${intArrayExpr(param)} + ")) OR EXISTS (SELECT 1 FROM ${CRF} fp2 ` +
    `WHERE fp2.conta_receber_id = ${contaCol} AND fp2.projeto_id = ANY(" + ${intArrayExpr(param)} + ")))"`;
  return `{{ params.${param} && params.${param}.length ? ${sql} : "" }}`;
}

/** Filtro por status de projeto exigindo vínculo (rateio ou faturamento). */
export function andProjetoStatusReceber(contaCol: string, param = 'statusProjeto'): string {
  const statusSql = (alias: string) =>
    `(params.${param} === 'todos' ? "" : " AND ${alias}.status = '" + String(params.${param}) + "'")`;
  const sql =
    `"AND (EXISTS (SELECT 1 FROM ${CRP} sp1 JOIN projetos s1 ON s1.id = sp1.projeto_id ` +
    `WHERE sp1.conta_receber_id = ${contaCol}" + ${statusSql('s1')} + ") OR EXISTS (SELECT 1 FROM ${CRF} sp2 ` +
    `JOIN projetos s2 ON s2.id = sp2.projeto_id WHERE sp2.conta_receber_id = ${contaCol}" + ${statusSql('s2')} + "))"`;
  return `{{ params.${param} ? ${sql} : "" }}`;
}
