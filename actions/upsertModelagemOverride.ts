import { action } from '@uibakery/data';

/**
 * Grava o override de uma célula.
 *
 * `limpar = true` força a célula a VAZIO; `valor = 0` força a ZERO. São coisas
 * diferentes e é por isso que `valor` é nullable.
 */
function upsertModelagemOverride() {
  return action('upsertModelagemOverride', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_overrides (modelagem_id, cenario_id, mes, linha, valor, limpar, created_by)
      VALUES (
        {{params.modelagemId}}::int,
        {{params.cenarioId}}::int,
        {{params.mes}}::int,
        '{{params.linha}}',
        {{params.valor}}::decimal,
        COALESCE({{params.limpar}}::boolean, FALSE),
        {{params.createdBy}}::int
      )
      ON CONFLICT (modelagem_id, cenario_id, mes, linha)
      DO UPDATE SET
        valor = EXCLUDED.valor,
        limpar = EXCLUDED.limpar,
        created_by = EXCLUDED.created_by,
        created_at = CURRENT_TIMESTAMP
    `,
  });
}

export default upsertModelagemOverride;
