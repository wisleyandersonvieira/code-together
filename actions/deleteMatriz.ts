import { action } from '@uibakery/data';

function deleteMatriz() {
  return action('deleteMatriz', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM matrizes 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteMatriz;
