import { action } from '@uibakery/data';

function deleteGrupo() {
  return action('deleteGrupo', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM grupos WHERE id = {{params.id}};
    `,
  });
}

export default deleteGrupo;
