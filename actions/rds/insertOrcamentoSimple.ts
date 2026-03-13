import { action } from '@uibakery/data';

function insertOrcamentoSimple() {
  return action('insertOrcamentoSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO orcamentos (
        id, projeto_id, data_inicio, data_fim, valor_total, descricao, status, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.projeto_id}}, {{params.data_inicio}}, {{params.data_fim}}, 
        {{params.valor_total}}, {{params.descricao}}, {{params.status}}, 
        {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        projeto_id = EXCLUDED.projeto_id,
        data_inicio = EXCLUDED.data_inicio,
        data_fim = EXCLUDED.data_fim,
        valor_total = EXCLUDED.valor_total,
        descricao = EXCLUDED.descricao,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertOrcamentoSimple;
