import { action } from '@uibakery/data';

function createTestUser() {
  return action('createTestUser', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO users (name, email, phone, role, password_hash, status)
      VALUES ('Admin Test', 'admin@provison.com', '(11) 99999-9999', 'admin', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'active')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email, role, status;
    `,
  });
}

export default createTestUser;
