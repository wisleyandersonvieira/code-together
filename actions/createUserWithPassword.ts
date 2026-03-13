import { action } from '@uibakery/data';

function createUserWithPassword() {
  return action('createUserWithPassword', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO users (name, email, phone, role, status, password_hash)
      VALUES ({{params.name}}, {{params.email}}, {{params.phone}}, {{params.role}}, {{params.status}}, {{params.passwordHash}})
      RETURNING id, name, email, phone, role, status, created_at, updated_at;
    `,
  });
}

export default createUserWithPassword;
