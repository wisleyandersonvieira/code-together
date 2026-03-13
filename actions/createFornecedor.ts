import { action } from '@uibakery/data';

function createFornecedor() {
  return action('createFornecedor', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO fornecedores (name, address, phone, email, contact_name, contact_phone, ein_number)
      VALUES ({{ params.name ? "'" + params.name + "'" : "NULL" }}, {{ params.address ? "'" + params.address + "'" : "NULL" }}, {{ params.phone ? "'" + params.phone + "'" : "NULL" }}, {{ params.email ? "'" + params.email + "'" : "NULL" }}, 
              {{ params.contactName ? "'" + params.contactName + "'" : "NULL" }}, {{ params.contactPhone ? "'" + params.contactPhone + "'" : "NULL" }}, {{ params.einNumber ? "'" + params.einNumber + "'" : "NULL" }})
      RETURNING id, name, address, phone, email, contact_name, contact_phone, ein_number, created_at, updated_at;
    `,
  });
}

export default createFornecedor;
