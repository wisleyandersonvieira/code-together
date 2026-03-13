import { action } from '@uibakery/data';

function loadOrcamentosComAlocacoes() {
  return action('loadOrcamentosComAlocacoes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        o.id,
        o.description,
        o.fornecedor_id,
        o.predicted_date,
        o.value,
        COALESCE(SUM(cpoa.valor_alocado), 0) as valor_alocado
      FROM orcamentos o
      LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
      WHERE o.projeto_id = {{params.projetoId}}
      GROUP BY o.id, o.description, o.fornecedor_id, o.predicted_date, o.value
      ORDER BY o.id;
    `,
  });
}

export default loadOrcamentosComAlocacoes;
