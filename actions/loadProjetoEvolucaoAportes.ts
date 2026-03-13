import { action } from '@uibakery/data';

function loadProjetoEvolucaoAportes() {
  return action('loadProjetoEvolucaoAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pa.id as aporte_id,
        pa.data_previsao,
        pa.valor_previsto,
        COALESCE(SUM(ra.valor_rateado), 0) as valor_realizado,
        (pa.valor_previsto - COALESCE(SUM(ra.valor_rateado), 0)) as saldo_restante,
        CASE 
          WHEN pm.cliente_id IS NOT NULL THEN c.name
          WHEN pm.empresa_id IS NOT NULL THEN e.name
          WHEN pm.grupo_id IS NOT NULL THEN g.name
        END as membro_nome,
        CASE 
          WHEN pm.cliente_id IS NOT NULL THEN 'cliente'
          WHEN pm.empresa_id IS NOT NULL THEN 'empresa'
          WHEN pm.grupo_id IS NOT NULL THEN 'grupo'
        END as membro_tipo,
        CASE 
          WHEN COALESCE(SUM(ra.valor_rateado), 0) >= pa.valor_previsto THEN 'CONCLUÍDO'
          WHEN COALESCE(SUM(ra.valor_rateado), 0) > 0 THEN 'EM ANDAMENTO'
          ELSE 'PENDENTE'
        END as status
      FROM previsao_aportes pa
      LEFT JOIN rateio_aportes ra ON pa.id = ra.aporte_id
      LEFT JOIN projeto_members pm ON pa.membro_id = pm.id
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id 
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      WHERE pa.projeto_id = {{params.projetoId}}
      GROUP BY pa.id, pa.data_previsao, pa.valor_previsto, pm.cliente_id, pm.empresa_id, pm.grupo_id, c.name, e.name, g.name
      ORDER BY pa.data_previsao, membro_tipo, membro_nome;
    `,
  });
}

export default loadProjetoEvolucaoAportes;
