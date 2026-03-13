import { action } from '@uibakery/data';

function updateOrcamentosProjeto() {
  return action('updateOrcamentosProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH existing_orcamentos AS (
        SELECT id, description, fornecedor_id, predicted_date, value
        FROM orcamentos 
        WHERE projeto_id = {{params.projetoId}}
      ),
      new_orcamentos AS (
        SELECT 
          {{params.description}} as description,
          {{params.fornecedorId}} as fornecedor_id,
          {{params.predictedDate}} as predicted_date,
          {{params.value}} as value,
          {{params.orcamentoIndex}} as ordem
      )
      -- Primeiro, verificar se há alocações existentes que seriam perdidas
      SELECT 
        o.id as orcamento_id,
        o.description,
        COALESCE(SUM(cpoa.valor_alocado), 0) as total_alocado
      FROM orcamentos o
      LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
      WHERE o.projeto_id = {{params.projetoId}}
      GROUP BY o.id, o.description
      HAVING COALESCE(SUM(cpoa.valor_alocado), 0) > 0;
    `,
  });
}

export default updateOrcamentosProjeto;
