import { action } from '@uibakery/data';

function getAllUsersIds() {
  return action('getAllUsersIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM users 
      ORDER BY id;
    `,
  });
}

export default getAllUsersIds;
