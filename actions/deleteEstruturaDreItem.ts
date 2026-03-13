import { action } from '@uibakery/data';

function deleteEstruturaDreItem() {
  return action('deleteEstruturaDreItem', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM estruturas_dre_itens 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteEstruturaDreItem;
