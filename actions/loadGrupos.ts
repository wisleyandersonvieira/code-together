import { action } from '@uibakery/data';

function loadGrupos() {
  return action('loadGrupos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT g.id, g.name, g.file_urls, g.created_at, g.updated_at,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'cliente_id', gm.cliente_id,
                   'empresa_id', gm.empresa_id,
                   'cliente_name', c.name,
                   'empresa_name', e.name,
                   'percentage', gm.percentage
                 )
               ) FILTER (WHERE gm.id IS NOT NULL),
               '[]'::json
             ) as members
      FROM grupos g
      LEFT JOIN grupo_members gm ON g.id = gm.grupo_id
      LEFT JOIN clientes c ON gm.cliente_id = c.id
      LEFT JOIN empresas e ON gm.empresa_id = e.id
      GROUP BY g.id, g.name, g.file_urls, g.created_at, g.updated_at
      ORDER BY g.name;
    `,
  });
}

export default loadGrupos;
