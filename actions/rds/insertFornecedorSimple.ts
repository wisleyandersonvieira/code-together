import { action } from '@uibakery/data';

function insertFornecedorSimple() {
  return action('insertFornecedorSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO fornecedores (id, name, address, phone, email, contact_name, contact_phone, ein_number)
      VALUES ({{params.id}}, '{{params.name || ""}}', '{{params.address || ""}}', '{{params.phone || ""}}', '{{params.email || ""}}', '{{params.contact_name || params.contact || ""}}', '{{params.contact_phone || ""}}', '{{params.ein_number || ""}}')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        contact_name = EXCLUDED.contact_name,
        contact_phone = EXCLUDED.contact_phone,
        ein_number = EXCLUDED.ein_number,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertFornecedorSimple;
