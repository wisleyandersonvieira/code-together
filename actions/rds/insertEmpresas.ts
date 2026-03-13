import { action } from '@uibakery/data';

function insertEmpresas() {
  return action('insertEmpresas', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO empresas (id, name, number, file_urls, created_at, updated_at)
      VALUES {{ 
        params.empresas.map(e => 
          "(" + 
          e.id + ", " +
          (e.name ? "'" + e.name.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (e.number ? "'" + e.number.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (e.file_urls && e.file_urls.length > 0 ? "ARRAY[" + e.file_urls.map(url => "'" + url.replace(/'/g, "''") + "'").join(', ') + "]" : "NULL") + ", " +
          (e.created_at ? "'" + e.created_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (e.updated_at ? "'" + e.updated_at + "'" : "CURRENT_TIMESTAMP") +
          ")"
        ).join(', ') 
      }}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        number = EXCLUDED.number,
        file_urls = EXCLUDED.file_urls,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertEmpresas;
