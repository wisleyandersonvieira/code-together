import { action } from '@uibakery/data';

function deleteModelagemCusto() {
  return action('deleteModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_custos WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemCusto;
