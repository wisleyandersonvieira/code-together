import { action } from '@uibakery/data';

function createGrupo() {
  return action('createGrupo', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupos (name, file_urls)
      VALUES ('{{params.name}}', '{}')
      RETURNING id, name, file_urls, created_at, updated_at;
    `,
  });
}

export default createGrupo;
