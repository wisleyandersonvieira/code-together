import { action } from '@uibakery/data';

function insertUsers() {
  return action('insertUsers', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO users (id, name, email, phone, role, status, created_at, updated_at, password_hash, password_reset_token, password_reset_expires, last_login)
      VALUES {{ 
        params.users.map(u => {
          const name = u.name ? "'" + String(u.name).replace(/'/g, "''") + "'" : "NULL";
          const email = u.email ? "'" + String(u.email).replace(/'/g, "''") + "'" : "NULL";
          const phone = u.phone ? "'" + String(u.phone).replace(/'/g, "''") + "'" : "NULL";
          const role = u.role ? "'" + String(u.role).replace(/'/g, "''") + "'" : "NULL";
          const status = u.status ? "'" + String(u.status).replace(/'/g, "''") + "'" : "NULL";
          const created_at = u.created_at ? "'" + u.created_at + "'" : "CURRENT_TIMESTAMP";
          const updated_at = u.updated_at ? "'" + u.updated_at + "'" : "CURRENT_TIMESTAMP";
          const password_hash = u.password_hash ? "'" + String(u.password_hash).replace(/'/g, "''") + "'" : "NULL";
          const password_reset_token = u.password_reset_token ? "'" + String(u.password_reset_token).replace(/'/g, "''") + "'" : "NULL";
          const password_reset_expires = u.password_reset_expires ? "'" + u.password_reset_expires + "'" : "NULL";
          const last_login = u.last_login ? "'" + u.last_login + "'" : "NULL";
          
          return "(" + [u.id, name, email, phone, role, status, created_at, updated_at, password_hash, password_reset_token, password_reset_expires, last_login].join(", ") + ")";
        }).join(', ') 
      }}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP,
        password_hash = EXCLUDED.password_hash,
        password_reset_token = EXCLUDED.password_reset_token,
        password_reset_expires = EXCLUDED.password_reset_expires,
        last_login = EXCLUDED.last_login;
    `,
  });
}

export default insertUsers;
