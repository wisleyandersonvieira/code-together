import { action } from '@uibakery/data';

function insertEmpresaSimple() {
  return action('insertEmpresaSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO empresas (id, name, number)
      VALUES ({{params.id}}, '{{params.name || ""}}', '{{params.number || ""}}')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        number = EXCLUDED.number,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertEmpresaSimple;
