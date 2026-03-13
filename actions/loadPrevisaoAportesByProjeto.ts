import { action } from '@uibakery/data';

function loadPrevisaoAportesByProjeto() {
  return action('loadPrevisaoAportesByProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pa.*,
        pm.percentage,
        COALESCE(c.name, e.name, g.name) as membro_nome,
        CASE 
          WHEN pm.cliente_id IS NOT NULL THEN 'cliente'
          WHEN pm.empresa_id IS NOT NULL THEN 'empresa'
          ELSE 'grupo'
        END as membro_tipo
      FROM previsao_aportes pa
      INNER JOIN projeto_members pm ON pa.membro_id = pm.id
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      WHERE pa.projeto_id = {{params.projetoId}}
      ORDER BY pa.data_previsao, membro_nome;
    `,
  });
}

export default loadPrevisaoAportesByProjeto;
