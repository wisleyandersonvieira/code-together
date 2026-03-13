import { action } from '@uibakery/data';

function testAuthentication() {
  return action('testAuthentication', 'SQL', {
    databaseName: 'provision',
    query: `SELECT id, name, email, role, status FROM users LIMIT 5;`,
  });
}

export default testAuthentication;
