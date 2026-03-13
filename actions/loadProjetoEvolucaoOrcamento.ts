import { action } from '@uibakery/data';

function loadProjetoEvolucaoOrcamento() {
  return action('loadProjetoEvolucaoOrcamento', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        o.id as orcamento_id,
        o.description,
        o.predicted_date,
        o.value as valor_orcado,
        COALESCE(SUM(cpoa.valor_alocado), 0) as valor_realizado,
        (o.value - COALESCE(SUM(cpoa.valor_alocado), 0)) as saldo_restante,
        CASE 
          WHEN COALESCE(SUM(cpoa.valor_alocado), 0) >= o.value THEN 'CONCLUÍDO'
          WHEN COALESCE(SUM(cpoa.valor_alocado), 0) > 0 THEN 'EM ANDAMENTO'
          ELSE 'PENDENTE'
        END as status
      FROM orcamentos o
      LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
      WHERE o.projeto_id = {{params.projetoId}}
      GROUP BY o.id, o.description, o.predicted_date, o.value
      ORDER BY o.predicted_date NULLS LAST, o.id;
    `,
  });
}

export default loadProjetoEvolucaoOrcamento;
