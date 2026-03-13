import { action } from '@uibakery/data';

function deleteGrupoContabil() {
  return action('deleteGrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM grupos_contabeis 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteGrupoContabil;
