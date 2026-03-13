import { action } from '@uibakery/data';

function updateCliente() {
  return action('updateCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE clientes 
      SET 
        name = '{{params.name}}', 
        address = {{params.address ? "'" + params.address.replace(/'/g, "''") + "'" : "NULL"}}, 
        phone = {{params.phone ? "'" + params.phone.replace(/'/g, "''") + "'" : "NULL"}}, 
        email = {{params.email ? "'" + params.email.replace(/'/g, "''") + "'" : "NULL"}}, 
        cpf = {{params.cpf ? "'" + params.cpf.replace(/'/g, "''") + "'" : "NULL"}}, 
        birth_date = {{params.birthDate ? "'" + params.birthDate + "'" : "NULL"}},
        file_urls = {{params.fileUrls && params.fileUrls.length > 0 ? "ARRAY['" + params.fileUrls.join("','") + "']" : "NULL"}}, 
        active = {{params.active}}, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, name, address, phone, email, cpf, birth_date, file_urls, active, created_at, updated_at;
    `,
  });
}

export default updateCliente;
