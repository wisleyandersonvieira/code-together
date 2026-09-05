import { action } from '@uibakery/data';

function updateGrupo() {
  return action('updateGrupo', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE grupos 
      SET 
        name = {{params.name ? "'" + params.name + "'" : "NULL"}}, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, name, file_urls, created_at, updated_at;
    `,
  });
}

export default updateGrupo;
