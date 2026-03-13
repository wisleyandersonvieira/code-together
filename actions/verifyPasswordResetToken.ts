import { action } from '@uibakery/data';

function verifyPasswordResetToken() {
  return action('verifyPasswordResetToken', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id, email, name
      FROM users 
      WHERE password_reset_token = '{{params.token}}' 
        AND password_reset_expires > CURRENT_TIMESTAMP;
    `,
  });
}

export default verifyPasswordResetToken;
