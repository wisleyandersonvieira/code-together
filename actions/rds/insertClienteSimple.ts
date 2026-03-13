import { action } from '@uibakery/data';

function insertClienteSimple() {
  return action('insertClienteSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO clientes (id, name, address, phone, email, cpf, birth_date, active)
      VALUES ({{params.id}}, '{{params.name || ""}}', '{{params.address || ""}}', '{{params.phone || ""}}', '{{params.email || ""}}', '{{params.cpf || ""}}', {{params.birth_date ? "'" + params.birth_date + "'" : "NULL"}}, {{params.active !== undefined ? params.active : true}})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        cpf = EXCLUDED.cpf,
        birth_date = EXCLUDED.birth_date,
        active = EXCLUDED.active,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertClienteSimple;
