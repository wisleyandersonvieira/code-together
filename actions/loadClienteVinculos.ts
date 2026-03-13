import { action } from '@uibakery/data';

function loadClienteVinculos() {
  return action('loadClienteVinculos', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH cliente_empresas AS (
        SELECT 
          ec.cliente_id,
          'empresa' as tipo,
          e.name as nome,
          e.id as entity_id,
          ec.percentage
        FROM empresa_clientes ec
        JOIN empresas e ON ec.empresa_id = e.id
        WHERE ec.cliente_id = {{params.clienteId}}
      ),
      cliente_grupos AS (
        SELECT 
          gm.cliente_id,
          'grupo' as tipo,
          g.name as nome,
          g.id as entity_id,
          gm.percentage
        FROM grupo_members gm
        JOIN grupos g ON gm.grupo_id = g.id
        WHERE gm.cliente_id = {{params.clienteId}}
      ),
      projetos_diretos AS (
        SELECT 
          pm.cliente_id,
          'projeto' as tipo,
          p.name as nome,
          p.id as entity_id,
          pm.percentage,
          'direto' as vinculo_tipo
        FROM projeto_members pm
        JOIN projetos p ON pm.projeto_id = p.id
        WHERE pm.cliente_id = {{params.clienteId}}
      ),
      projetos_via_empresa AS (
        SELECT DISTINCT
          ec.cliente_id,
          'projeto' as tipo,
          p.name as nome,
          p.id as entity_id,
          NULL as percentage,
          'via empresa' as vinculo_tipo
        FROM empresa_clientes ec
        JOIN projeto_members pm ON ec.empresa_id = pm.empresa_id
        JOIN projetos p ON pm.projeto_id = p.id
        WHERE ec.cliente_id = {{params.clienteId}}
      ),
      projetos_via_grupo AS (
        SELECT DISTINCT
          gm.cliente_id,
          'projeto' as tipo,
          p.name as nome,
          p.id as entity_id,
          NULL as percentage,
          'via grupo' as vinculo_tipo
        FROM grupo_members gm
        JOIN projeto_members pm ON gm.grupo_id = pm.grupo_id
        JOIN projetos p ON pm.projeto_id = p.id
        WHERE gm.cliente_id = {{params.clienteId}}
      )
      SELECT tipo, nome, entity_id, percentage::text, vinculo_tipo
      FROM (
        SELECT tipo, nome, entity_id, percentage, 'direto' as vinculo_tipo FROM cliente_empresas
        UNION ALL
        SELECT tipo, nome, entity_id, percentage, 'direto' as vinculo_tipo FROM cliente_grupos
        UNION ALL
        SELECT tipo, nome, entity_id, percentage, vinculo_tipo FROM projetos_diretos
        UNION ALL
        SELECT tipo, nome, entity_id, NULL as percentage, vinculo_tipo FROM projetos_via_empresa
        UNION ALL
        SELECT tipo, nome, entity_id, NULL as percentage, vinculo_tipo FROM projetos_via_grupo
      ) AS combined_results
      ORDER BY tipo, nome;
    `,
  });
}

export default loadClienteVinculos;
