import { action } from '@uibakery/data';

function createCliente() {
  return action('createCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO clientes (name, address, phone, email, cpf, birth_date, file_urls, active)
      VALUES (
        {{ params.name ? "'" + params.name.replace(/'/g, "''") + "'" : "NULL" }}, 
        {{ params.address ? "'" + params.address.replace(/'/g, "''") + "'" : "NULL" }}, 
        {{ params.phone ? "'" + params.phone.replace(/'/g, "''") + "'" : "NULL" }}, 
        {{ params.email ? "'" + params.email.replace(/'/g, "''") + "'" : "NULL" }}, 
        {{ params.cpf ? "'" + params.cpf.replace(/'/g, "''") + "'" : "NULL" }}, 
        {{ params.birthDate ? "'" + params.birthDate + "'" : "NULL" }}, 
        {{ params.fileUrls && params.fileUrls.length > 0 ? "ARRAY[" + params.fileUrls.map(url => "'" + String(url).replace(/'/g, "''") + "'").join(', ') + "]" : "NULL" }}, 
        {{params.active}}
      )
      RETURNING id, name, address, phone, email, cpf, birth_date, file_urls, active, created_at, updated_at;
    `,
  });
}

export default createCliente;
