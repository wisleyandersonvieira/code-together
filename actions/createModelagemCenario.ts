import { action } from '@uibakery/data';

/** Duplica o cenário atual (inclusive seus overrides) sob um novo nome. */
function createModelagemCenario() {
  return action('createModelagemCenario', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH novo AS (
        INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline)
        VALUES ({{params.modelagemId}}::int, '{{params.nome}}', FALSE)
        RETURNING id
      ),
      copia AS (
        INSERT INTO modelagem_overrides (modelagem_id, cenario_id, mes, linha, valor, limpar, created_by)
        SELECT o.modelagem_id, novo.id, o.mes, o.linha, o.valor, o.limpar, o.created_by
        FROM modelagem_overrides o, novo
        WHERE o.modelagem_id = {{params.modelagemId}}::int
          AND o.cenario_id = {{params.origemCenarioId}}::int
      )
      SELECT id FROM novo
    `,
  });
}

export default createModelagemCenario;
