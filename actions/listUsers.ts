import { action } from '@uibakery/data';

function listUsers() {
  return action('listUsers', 'SQL', {
    databaseName: 'provision',
    query: `SELECT id, name, email FROM users ORDER BY id LIMIT 5;`,
  });
}

export default listUsers;
