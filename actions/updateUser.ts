import { action } from '@uibakery/data';

function updateUser() {
  return action('updateUser', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE users 
      SET name = '{{params.name}}', email = '{{params.email}}', phone = '{{params.phone}}', 
          role = '{{params.role}}', status = '{{params.status}}', updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, name, email, phone, role, status, created_at, updated_at;
    `,
  });
}

export default updateUser;
