import { action } from '@uibakery/data';

function testUserAccess() {
  return action('testUserAccess', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT COUNT(*) as total_users
      FROM users;
    `,
  });
}

export default testUserAccess;
