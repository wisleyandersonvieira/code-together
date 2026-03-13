import { action } from '@uibakery/data';

function deleteUser() {
  return action('deleteUser', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM users WHERE id = {{params.id}};
    `,
  });
}

export default deleteUser;
