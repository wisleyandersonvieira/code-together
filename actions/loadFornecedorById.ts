import { action } from '@uibakery/data';

function loadFornecedorById() {
  return action('loadFornecedorById', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id, name, address, phone, email, contact_name, contact_phone, ein_number, created_at, updated_at
      FROM fornecedores
      WHERE id = {{params.id}};
    `,
  });
}

export default loadFornecedorById;
