import { action } from '@uibakery/data';

function updateOrcamento() {
  return action('updateOrcamento', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE orcamentos
      SET
        description = '{{params.description}}',
        fornecedor_id = {{ params.fornecedorId !== null && params.fornecedorId !== undefined ? params.fornecedorId : "NULL" }},
        predicted_date = {{ params.predictedDate ? "'" + new Date(params.predictedDate).toISOString().split('T')[0] + "'" : "NULL" }},
        value = {{params.value}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, projeto_id, description, fornecedor_id, predicted_date, value, created_at, updated_at;
    `,
  });
}

export default updateOrcamento;
