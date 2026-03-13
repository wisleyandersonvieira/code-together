import { action } from '@uibakery/data';

function updateLastLogin() {
  return action('updateLastLogin', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = {{params.userId}};
    `,
  });
}

export default updateLastLogin;
