import { action } from '@uibakery/data';

function insertAppUsers() {
  return action('insertAppUsers', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO app_users (id, name, email, phone, role, status, encrypted_password, password_reset_token, password_reset_expires_at, last_login_at, created_at, updated_at)
      VALUES {{ 
        params.users.map(u => 
          "(" + 
          u.id + ", " +
          (u.name ? "'" + u.name.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.email ? "'" + u.email.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.phone ? "'" + u.phone.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.role ? "'" + u.role.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.status ? "'" + u.status.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.encrypted_password ? "'" + u.encrypted_password.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.password_reset_token ? "'" + u.password_reset_token.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (u.password_reset_expires_at ? "'" + u.password_reset_expires_at + "'" : "NULL") + ", " +
          (u.last_login_at ? "'" + u.last_login_at + "'" : "NULL") + ", " +
          (u.created_at ? "'" + u.created_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (u.updated_at ? "'" + u.updated_at + "'" : "CURRENT_TIMESTAMP") +
          ")"
        ).join(', ') 
      }}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        encrypted_password = EXCLUDED.encrypted_password,
        password_reset_token = EXCLUDED.password_reset_token,
        password_reset_expires_at = EXCLUDED.password_reset_expires_at,
        last_login_at = EXCLUDED.last_login_at,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertAppUsers;
