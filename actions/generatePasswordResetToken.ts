import { action } from '@uibakery/data';

function generatePasswordResetToken() {
  return action('generatePasswordResetToken', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE users 
      SET password_reset_token = '{{params.token}}',
          password_reset_expires = '{{params.expiresAt}}'
      WHERE email = '{{params.email}}' AND status = 'active'
      RETURNING id, name, email;
    `,
  });
}

export default generatePasswordResetToken;
