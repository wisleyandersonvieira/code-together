import { action } from '@uibakery/data';

function deleteModelagemUnidade() {
  return action('deleteModelagemUnidade', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_unidades WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemUnidade;
