import { action } from '@uibakery/data';

function insertClientes() {
  return action('insertClientes', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO clientes (id, name, address, phone, email, cpf, birth_date, file_urls, created_at, updated_at, active)
      VALUES {{ 
        params.clientes.map(c => 
          "(" + 
          c.id + ", " +
          (c.name ? "'" + c.name.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.address ? "'" + c.address.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.phone ? "'" + c.phone.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.email ? "'" + c.email.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.cpf ? "'" + c.cpf.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.birth_date ? "'" + c.birth_date + "'" : "NULL") + ", " +
          (c.file_urls ? "ARRAY[" + c.file_urls.map(url => "'" + url.replace(/'/g, "''") + "'").join(', ') + "]" : "NULL") + ", " +
          (c.created_at ? "'" + c.created_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (c.updated_at ? "'" + c.updated_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (c.active !== undefined ? c.active : "true") +
          ")"
        ).join(', ') 
      }}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        cpf = EXCLUDED.cpf,
        birth_date = EXCLUDED.birth_date,
        file_urls = EXCLUDED.file_urls,
        updated_at = CURRENT_TIMESTAMP,
        active = EXCLUDED.active;
    `,
  });
}

export default insertClientes;
