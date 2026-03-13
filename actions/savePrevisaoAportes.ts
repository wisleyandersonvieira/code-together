import { action } from '@uibakery/data';

function savePrevisaoAportes() {
  return action('savePrevisaoAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO previsao_aportes (projeto_id, membro_id, data_previsao, valor_previsto, observacoes, created_at, updated_at)
      VALUES ({{params.projetoId}}, {{params.membroId}}, '{{params.dataPrevisao}}', {{params.valorPrevisto}}, {{ params.observacoes ? "'" + params.observacoes + "'" : "NULL" }}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (projeto_id, membro_id, data_previsao)
      DO UPDATE SET
        valor_previsto = EXCLUDED.valor_previsto,
        observacoes = {{ params.observacoes ? "'" + params.observacoes + "'" : "NULL" }},
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, projeto_id, membro_id, data_previsao, valor_previsto, observacoes;
    `,
  });
}

export default savePrevisaoAportes;
