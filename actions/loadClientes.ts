import { action } from '@uibakery/data';

function loadClientes() {
  return action('loadClientes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        c.id, 
        c.name, 
        c.address, 
        c.phone, 
        c.email, 
        c.cpf, 
        c.birth_date, 
        c.file_urls, 
        c.active,
        c.created_at, 
        c.updated_at,
        CASE 
          WHEN f.file_count > 0 THEN true 
          ELSE false 
        END as has_documents
      FROM clientes c
      LEFT JOIN (
        SELECT entity_id, COUNT(*) as file_count
        FROM files 
        WHERE entity_type = 'cliente_document'
        GROUP BY entity_id
      ) f ON c.id = f.entity_id
      WHERE 1 = 1
      {{ params && params.searchTerm ? "AND c.name ILIKE '%" + params.searchTerm + "%'" : "" }}
      ORDER BY c.name;
    `,
  });
}

export default loadClientes;
