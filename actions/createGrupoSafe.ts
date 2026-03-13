import { action } from '@uibakery/data';

function createGrupoSafe() {
  return action('createGrupoSafe', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupos (name, file_urls)
      VALUES ('{{params.name}}', '{}')
      RETURNING id, name, file_urls, created_at, updated_at;
    `,
  });
}

export default createGrupoSafe;
