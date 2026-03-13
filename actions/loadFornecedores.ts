import { action } from '@uibakery/data';

function loadFornecedores() {
  return action('loadFornecedores', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id, name, address, phone, email, contact_name, contact_phone, ein_number, created_at, updated_at
      FROM fornecedores
      WHERE 1 = 1
      {{ params && params.searchTerm ? "AND name ILIKE '%" + params.searchTerm + "%'" : "" }}
      ORDER BY name;
    `,
  });
}

export default loadFornecedores;
