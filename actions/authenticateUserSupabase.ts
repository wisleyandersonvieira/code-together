import { action } from '@uibakery/data';

function authenticateUserSupabase() {
  return action('authenticateUserSupabase', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      SELECT 
        id, 
        name, 
        email, 
        phone, 
        role, 
        status, 
        encrypted_password as password_hash, 
        last_login_at as last_login
      FROM app_users 
      WHERE email = {{params.email}} 
        AND (status = 'active' OR status = 'approved')
      LIMIT 1;
    `,
  });
}

export default authenticateUserSupabase;
