import { action } from '@uibakery/data';

function loadAllUsersDebug() {
  return action('loadAllUsersDebug', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id, 
        name, 
        email, 
        role, 
        status
      FROM users 
      ORDER BY id
      LIMIT 10;
    `,
  });
}

export default loadAllUsersDebug;
