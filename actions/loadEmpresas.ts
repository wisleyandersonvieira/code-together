import { action } from '@uibakery/data';

function loadEmpresas() {
  return action('loadEmpresas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT e.id, e.name, e.number, e.file_urls, e.created_at, e.updated_at,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'cliente_id', ec.cliente_id,
                   'cliente_name', c.name,
                   'percentage', ec.percentage
                 )
               ) FILTER (WHERE ec.id IS NOT NULL),
               '[]'::json
             ) as clientes
      FROM empresas e
      LEFT JOIN empresa_clientes ec ON e.id = ec.empresa_id
      LEFT JOIN clientes c ON ec.cliente_id = c.id
      WHERE 1 = 1
      {{ params && params.clienteId ? "AND ec.cliente_id = " + params.clienteId : "" }}
      {{ params && params.searchTerm ? "AND e.name ILIKE '%" + params.searchTerm + "%'" : "" }}
      GROUP BY e.id, e.name, e.number, e.file_urls, e.created_at, e.updated_at
      ORDER BY e.name;
    `,
  });
}

export default loadEmpresas;
