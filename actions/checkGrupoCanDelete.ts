import { action } from '@uibakery/data';

function checkGrupoCanDelete() {
  return action('checkGrupoCanDelete', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH grupo_relationships AS (
        -- Projetos onde o grupo participa diretamente
        SELECT 'projetos_direto' as table_name, COUNT(*) as count
        FROM projeto_members pm
        WHERE pm.grupo_id = {{params.grupoId}}
        
        UNION ALL
        
        -- Contas a pagar relacionadas ao grupo
        SELECT 'contas_pagar' as table_name, COUNT(*) as count
        FROM contas_pagar cp
        WHERE cp.entity_type = 'grupo' AND cp.entity_id = {{params.grupoId}}
        
        UNION ALL
        
        -- Contas a receber relacionadas ao grupo
        SELECT 'contas_receber' as table_name, COUNT(*) as count
        FROM contas_receber cr
        WHERE cr.entity_type = 'grupo' AND cr.entity_id = {{params.grupoId}}
      )
      SELECT 
        table_name,
        count,
        CASE 
          WHEN SUM(count) OVER () > 0 THEN false
          ELSE true
        END as can_delete,
        SUM(count) OVER () as total_relationships
      FROM grupo_relationships
      WHERE count > 0
      
      UNION ALL
      
      SELECT 
        'summary' as table_name,
        0 as count,
        CASE 
          WHEN NOT EXISTS (
            SELECT 1 FROM projeto_members WHERE grupo_id = {{params.grupoId}}
            UNION ALL
            SELECT 1 FROM contas_pagar WHERE entity_type = 'grupo' AND entity_id = {{params.grupoId}}
            UNION ALL
            SELECT 1 FROM contas_receber WHERE entity_type = 'grupo' AND entity_id = {{params.grupoId}}
          ) THEN true
          ELSE false
        END as can_delete,
        0 as total_relationships;
    `,
  });
}

export default checkGrupoCanDelete;
