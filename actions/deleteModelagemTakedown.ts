import { action } from '@uibakery/data';

function deleteModelagemTakedown() {
  return action('deleteModelagemTakedown', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_takedowns WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemTakedown;
