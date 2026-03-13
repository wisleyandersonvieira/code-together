import { action } from '@uibakery/data';

function insertUsersSimple() {
  return action('insertUsersSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO users (id, name, email, role, status)
      VALUES ({{params.id}}, '{{params.name}}', '{{params.email}}', '{{params.role}}', '{{params.status}}')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertUsersSimple;
