import { action } from '@uibakery/data';

function saveBatchPrevisaoAportes() {
  return action('saveBatchPrevisaoAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH previsoes_data AS (
        SELECT 
          unnest(string_to_array('{{params.projetoIds}}', ','))::integer as projeto_id,
          unnest(string_to_array('{{params.membroIds}}', ','))::integer as membro_id,
          unnest(string_to_array('{{params.datasPrevisao}}', ',')) as data_previsao,
          unnest(string_to_array('{{params.valoresPrevisto}}', ','))::numeric as valor_previsto,
          unnest(string_to_array('{{params.observacoesList}}', '|')) as observacoes
      )
      INSERT INTO previsao_aportes (projeto_id, membro_id, data_previsao, valor_previsto, observacoes, created_at, updated_at)
      SELECT 
        projeto_id,
        membro_id,
        data_previsao::date,
        valor_previsto,
        NULLIF(observacoes, 'NULL') as observacoes,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM previsoes_data
      ON CONFLICT (projeto_id, membro_id, data_previsao)
      DO UPDATE SET
        valor_previsto = EXCLUDED.valor_previsto,
        observacoes = NULLIF(EXCLUDED.observacoes, 'NULL'),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, projeto_id, membro_id, data_previsao, valor_previsto, observacoes;
    `,
  });
}

export default saveBatchPrevisaoAportes;
