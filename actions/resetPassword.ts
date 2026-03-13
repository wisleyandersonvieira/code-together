import { action } from '@uibakery/data';

function resetPassword() {
  return action('resetPassword', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE users 
      SET password_hash = '{{params.newPasswordHash}}',
          password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE password_reset_token = '{{params.token}}' 
        AND password_reset_expires > CURRENT_TIMESTAMP
      RETURNING id, email;
    `,
  });
}

export default resetPassword;
