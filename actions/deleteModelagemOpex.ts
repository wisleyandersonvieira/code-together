import { action } from '@uibakery/data';

function deleteModelagemOpex() {
  return action('deleteModelagemOpex', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_opex WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemOpex;
