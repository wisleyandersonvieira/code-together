import { action } from '@uibakery/data';

function insertGrupoSimple() {
  return action('insertGrupoSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupos (id, name, file_urls)
      VALUES ({{params.id}}, '{{params.name ? params.name.replace(/'/g, "''") : ""}}', ARRAY[]::text[])
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        file_urls = EXCLUDED.file_urls,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertGrupoSimple;
