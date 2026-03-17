import { action } from '@uibakery/data';

/**
 * Consolidated query that loads project-specific edit data in a single call:
 * existing orcamentos with allocations + previsao aportes check.
 */
function loadProjetoEditData() {
  return action('loadProjetoEditData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT json_build_object(
        'orcamentos', (
          SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json)
          FROM (
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
            ORDER BY o.id
          ) o
        ),
        'previsao', (
          SELECT row_to_json(p)
          FROM (
            SELECT 
              COUNT(*) as total_aportes,
              COUNT(DISTINCT pa.membro_id) as membros_com_aportes,
              (SELECT COUNT(*) FROM projeto_members WHERE projeto_id = {{params.projetoId}}) as total_membros_projeto
            FROM previsao_aportes pa
            WHERE pa.projeto_id = {{params.projetoId}}
          ) p
        )
      ) as data;
    `,
  });
}

export default loadProjetoEditData;
