import { action } from '@uibakery/data';

function insertPrevisaoAporteSimple() {
  return action('insertPrevisaoAporteSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO previsao_aportes (
        id, projeto_id, data_previsao, valor_previsto, descricao, status, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.projeto_id}}, {{params.data_previsao}}, {{params.valor_previsto}}, 
        {{params.descricao}}, {{params.status}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        projeto_id = EXCLUDED.projeto_id,
        data_previsao = EXCLUDED.data_previsao,
        valor_previsto = EXCLUDED.valor_previsto,
        descricao = EXCLUDED.descricao,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertPrevisaoAporteSimple;
