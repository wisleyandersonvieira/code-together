import { action } from '@uibakery/data';

function checkClienteCanDelete() {
  return action('checkClienteCanDelete', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH client_relationships AS (
        -- Contas a receber do cliente
        SELECT 'contas_receber' as table_name, COUNT(*) as count
        FROM contas_receber cr
        WHERE cr.cliente_id = {{params.clienteId}}
        
        UNION ALL
        
        -- Projetos onde o cliente participa diretamente
        SELECT 'projetos_direto' as table_name, COUNT(*) as count
        FROM projeto_members pm
        WHERE pm.cliente_id = {{params.clienteId}}
        
        UNION ALL
        
        -- Projetos onde empresas do cliente participam
        SELECT 'projetos_via_empresa' as table_name, COUNT(*) as count
        FROM empresa_clientes ec
        JOIN projeto_members pm ON ec.empresa_id = pm.empresa_id
        WHERE ec.cliente_id = {{params.clienteId}}
        
        UNION ALL
        
        -- Projetos onde grupos do cliente participam
        SELECT 'projetos_via_grupo' as table_name, COUNT(*) as count
        FROM grupo_members gm
        JOIN projeto_members pm ON gm.grupo_id = pm.grupo_id
        WHERE gm.cliente_id = {{params.clienteId}}
      )
      SELECT 
        table_name,
        count,
        CASE 
          WHEN SUM(count) OVER () > 0 THEN false
          ELSE true
        END as can_delete,
        SUM(count) OVER () as total_relationships
      FROM client_relationships
      WHERE count > 0
      
      UNION ALL
      
      SELECT 
        'summary' as table_name,
        0 as count,
        CASE 
          WHEN NOT EXISTS (
            SELECT 1 FROM contas_receber WHERE cliente_id = {{params.clienteId}}
            UNION ALL
            SELECT 1 FROM projeto_members WHERE cliente_id = {{params.clienteId}}
            UNION ALL
            SELECT 1 FROM empresa_clientes ec 
            JOIN projeto_members pm ON ec.empresa_id = pm.empresa_id 
            WHERE ec.cliente_id = {{params.clienteId}}
            UNION ALL
            SELECT 1 FROM grupo_members gm 
            JOIN projeto_members pm ON gm.grupo_id = pm.grupo_id 
            WHERE gm.cliente_id = {{params.clienteId}}
          ) THEN true
          ELSE false
        END as can_delete,
        0 as total_relationships;
    `,
  });
}

export default checkClienteCanDelete;
