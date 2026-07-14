import { action } from '@uibakery/data';

function loadAportesPorCliente() {
  return action('loadAportesPorCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH realizado_por_aporte AS (
        SELECT
          aporte_id,
          SUM(valor_rateado) as valor_realizado
        FROM rateio_aportes
        GROUP BY aporte_id
      )
      SELECT
        CONCAT(
          CASE
            WHEN pm.cliente_id IS NOT NULL THEN 'cliente'
            WHEN pm.empresa_id IS NOT NULL THEN 'empresa'
            WHEN pm.grupo_id IS NOT NULL THEN 'grupo'
          END,
          '-',
          COALESCE(pm.cliente_id, pm.empresa_id, pm.grupo_id)
        ) as membro_key,
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
        p.id as projeto_id,
        p.name as projeto_nome,
        p.status as projeto_status,
        COALESCE(SUM(pa.valor_previsto), 0) as total_previsto,
        COALESCE(SUM(rpa.valor_realizado), 0) as total_realizado
      FROM previsao_aportes pa
      INNER JOIN projeto_members pm ON pa.membro_id = pm.id
      INNER JOIN projetos p ON pa.projeto_id = p.id
      LEFT JOIN realizado_por_aporte rpa ON rpa.aporte_id = pa.id
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      GROUP BY
        pm.cliente_id, pm.empresa_id, pm.grupo_id,
        c.name, e.name, g.name,
        p.id, p.name, p.status
      ORDER BY total_realizado DESC, membro_nome;
    `,
  });
}

export default loadAportesPorCliente;
