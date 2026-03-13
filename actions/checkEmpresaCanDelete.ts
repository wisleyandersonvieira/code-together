import { action } from '@uibakery/data';

function checkEmpresaCanDelete() {
  return action('checkEmpresaCanDelete', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH empresa_relationships AS (
        -- Projetos onde a empresa participa diretamente
        SELECT 'projetos_direto' as table_name, COUNT(*) as count
        FROM projeto_members pm
        WHERE pm.empresa_id = {{params.empresaId}}
        
        UNION ALL
        
        -- Projetos onde grupos da empresa participam
        SELECT 'projetos_via_grupo' as table_name, COUNT(*) as count
        FROM grupo_members gm
        JOIN projeto_members pm ON gm.grupo_id = pm.grupo_id
        WHERE gm.empresa_id = {{params.empresaId}}
        
        UNION ALL
        
        -- Contas a pagar relacionadas à empresa
        SELECT 'contas_pagar' as table_name, COUNT(*) as count
        FROM contas_pagar cp
        WHERE cp.entity_type = 'empresa' AND cp.entity_id = {{params.empresaId}}
        
        UNION ALL
        
        -- Contas a receber relacionadas à empresa
        SELECT 'contas_receber' as table_name, COUNT(*) as count
        FROM contas_receber cr
        WHERE cr.entity_type = 'empresa' AND cr.entity_id = {{params.empresaId}}
      )
      SELECT 
        table_name,
        count,
        CASE 
          WHEN SUM(count) OVER () > 0 THEN false
          ELSE true
        END as can_delete,
        SUM(count) OVER () as total_relationships
      FROM empresa_relationships
      WHERE count > 0
      
      UNION ALL
      
      SELECT 
        'summary' as table_name,
        0 as count,
        CASE 
          WHEN NOT EXISTS (
            SELECT 1 FROM projeto_members WHERE empresa_id = {{params.empresaId}}
            UNION ALL
            SELECT 1 FROM grupo_members gm 
            JOIN projeto_members pm ON gm.grupo_id = pm.grupo_id 
            WHERE gm.empresa_id = {{params.empresaId}}
            UNION ALL
            SELECT 1 FROM contas_pagar WHERE entity_type = 'empresa' AND entity_id = {{params.empresaId}}
            UNION ALL
            SELECT 1 FROM contas_receber WHERE entity_type = 'empresa' AND entity_id = {{params.empresaId}}
          ) THEN true
          ELSE false
        END as can_delete,
        0 as total_relationships;
    `,
  });
}

export default checkEmpresaCanDelete;
