import { action } from '@uibakery/data';

function loadUsers() {
  return action('loadUsers', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id, name, email, phone, role, status, created_at, updated_at
      FROM users
      ORDER BY created_at DESC;
    `,
  });
}

export default loadUsers;
