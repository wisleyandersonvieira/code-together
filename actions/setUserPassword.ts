import { action } from '@uibakery/data';

function setUserPassword() {
  return action('setUserPassword', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE users 
      SET password_hash = '{{params.passwordHash}}'
      WHERE email = '{{params.email}}' AND status = 'active'
      RETURNING id, email, name;
    `,
  });
}

export default setUserPassword;
