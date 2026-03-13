import { action } from '@uibakery/data';

function authenticateUser() {
  return action('authenticateUser', 'SQL', {
    databaseName: 'provision',
    query: `SELECT id, name, email, role, status, password_hash FROM users WHERE email = '{{params.email}}' LIMIT 1;`,
  });
}

export default authenticateUser;
