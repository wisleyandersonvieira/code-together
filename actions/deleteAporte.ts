import { action } from '@uibakery/data';

function deleteAporte() {
  return action('deleteAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM aportes WHERE id = {{params.id}}::int;
    `,
  });
}

export default deleteAporte;
