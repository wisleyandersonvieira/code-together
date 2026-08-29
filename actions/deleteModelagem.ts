import { action } from '@uibakery/data';

function deleteModelagem() {
  return action('deleteModelagem', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagens WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagem;
