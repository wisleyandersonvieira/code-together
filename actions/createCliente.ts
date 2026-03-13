import { action } from '@uibakery/data';

function createCliente() {
  return action('createCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO clientes (name, address, phone, email, cpf, birth_date, file_urls, active)
      VALUES (
        {{ params.name ? "'" + params.name + "'" : "NULL" }}, 
        {{ params.address ? "'" + params.address + "'" : "NULL" }}, 
        {{ params.phone ? "'" + params.phone + "'" : "NULL" }}, 
        {{ params.email ? "'" + params.email + "'" : "NULL" }}, 
        {{ params.cpf ? "'" + params.cpf + "'" : "NULL" }}, 
        {{ params.birthDate ? "'" + params.birthDate + "'" : "NULL" }}, 
        {{ params.fileUrls && params.fileUrls.length > 0 ? "ARRAY[" + params.fileUrls.map(url => "'" + url + "'").join(', ') + "]" : "NULL" }}, 
        {{params.active}}
      )
      RETURNING id, name, address, phone, email, cpf, birth_date, file_urls, active, created_at, updated_at;
    `,
  });
}

export default createCliente;
