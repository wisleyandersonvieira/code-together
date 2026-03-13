import { action } from '@uibakery/data';

function createOrcamento() {
  return action('createOrcamento', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO orcamentos (projeto_id, description, fornecedor_id, predicted_date, value)
      VALUES ({{params.projetoId}}, {{ params.description ? "'" + params.description + "'" : "NULL" }}, {{params.fornecedorId}}, {{ params.predictedDate ? "'" + new Date(params.predictedDate).toISOString().split('T')[0] + "'" : "NULL" }}, {{params.value || "NULL"}})
      RETURNING id, projeto_id, description, fornecedor_id, predicted_date, value, created_at, updated_at;
    `,
  });
}

export default createOrcamento;
