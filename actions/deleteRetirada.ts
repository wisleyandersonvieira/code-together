import { action } from '@uibakery/data';

function deleteRetirada() {
  return action('deleteRetirada', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM retiradas WHERE id = {{params.id}}::int;
    `,
  });
}

export default deleteRetirada;
