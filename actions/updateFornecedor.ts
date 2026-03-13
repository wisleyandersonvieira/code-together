import { action } from '@uibakery/data';

function updateFornecedor() {
  return action('updateFornecedor', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE fornecedores 
      SET 
        name = {{ params.name ? "'" + params.name + "'" : "NULL" }}, 
        address = {{ params.address ? "'" + params.address + "'" : "NULL" }}, 
        phone = {{ params.phone ? "'" + params.phone + "'" : "NULL" }}, 
        email = {{ params.email ? "'" + params.email + "'" : "NULL" }}, 
        contact_name = {{ params.contactName ? "'" + params.contactName + "'" : "NULL" }}, 
        contact_phone = {{ params.contactPhone ? "'" + params.contactPhone + "'" : "NULL" }}, 
        ein_number = {{ params.einNumber ? "'" + params.einNumber + "'" : "NULL" }},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, name, address, phone, email, contact_name, contact_phone, ein_number, created_at, updated_at;
    `,
  });
}

export default updateFornecedor;
