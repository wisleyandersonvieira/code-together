import { action } from '@uibakery/data';

function loadRelatorioProjetoReceitasPorCliente() {
  return action('loadRelatorioProjetoReceitasPorCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        CASE 
          WHEN cr.entity_type = 'cliente' THEN c.name
          WHEN cr.entity_type = 'empresa' THEN e.name
          WHEN cr.entity_type = 'grupo' THEN g.name
          ELSE 'Desconhecido'
        END as cliente_nome,
        SUM(tr.valor) as valor_total
      FROM titulos_receber tr
      INNER JOIN contas_receber cr ON tr.conta_receber_id = cr.id
      LEFT JOIN clientes c ON cr.entity_type = 'cliente' AND cr.entity_id = c.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
      -- Include projects from both traditional rateio and faturamento
      LEFT JOIN (
        -- Projects from traditional rateio
        SELECT DISTINCT conta_receber_id, projeto_id
        FROM contas_receber_projetos
        
        UNION
        
        -- Projects from faturamento mode
        SELECT DISTINCT conta_receber_id, projeto_id
        FROM contas_receber_faturamento
      ) all_projetos ON cr.id = all_projetos.conta_receber_id
      WHERE 
        ({{params.projetoId}} IS NULL OR all_projetos.projeto_id = {{params.projetoId}})
        AND tr.status = 'RECEBIDO'
        AND cr.entity_type IN ('cliente', 'empresa', 'grupo')
      GROUP BY 
        cr.entity_type,
        CASE 
          WHEN cr.entity_type = 'cliente' THEN c.name
          WHEN cr.entity_type = 'empresa' THEN e.name
          WHEN cr.entity_type = 'grupo' THEN g.name
          ELSE 'Desconhecido'
        END
      ORDER BY SUM(tr.valor) DESC;
    `,
  });
}

export default loadRelatorioProjetoReceitasPorCliente;
