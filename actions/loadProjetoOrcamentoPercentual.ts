import { action } from '@uibakery/data';

function loadProjetoOrcamentoPercentual() {
  return action('loadProjetoOrcamentoPercentual', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id as projeto_id,
        COALESCE(SUM(o.value), 0) as total_orcado,
        COALESCE(SUM(cpoa.valor_alocado), 0) as total_realizado,
        CASE 
          WHEN COALESCE(SUM(o.value), 0) = 0 THEN 0
          ELSE ROUND((COALESCE(SUM(cpoa.valor_alocado), 0) / COALESCE(SUM(o.value), 0)) * 100, 1)
        END as percentual_realizado
      FROM projetos p
      LEFT JOIN orcamentos o ON p.id = o.projeto_id
      LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
      WHERE p.id = {{params.projetoId}}
      GROUP BY p.id;
    `,
  });
}

export default loadProjetoOrcamentoPercentual;
