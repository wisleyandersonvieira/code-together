import { action } from '@uibakery/data';

function deleteEstruturaDre() {
  return action('deleteEstruturaDre', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM estruturas_dre 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteEstruturaDre;
