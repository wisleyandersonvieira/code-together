import { action } from '@uibakery/data';

function createUser() {
  return action('createUser', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO users (name, email, phone, role, status)
      VALUES ({{ params.name ? "'" + params.name + "'" : "NULL" }}, {{ params.email ? "'" + params.email + "'" : "NULL" }}, {{ params.phone ? "'" + params.phone + "'" : "NULL" }}, {{ params.role ? "'" + params.role + "'" : "NULL" }}, {{ params.status ? "'" + params.status + "'" : "NULL" }})
      RETURNING id, name, email, phone, role, status, created_at, updated_at;
    `,
  });
}

export default createUser;
