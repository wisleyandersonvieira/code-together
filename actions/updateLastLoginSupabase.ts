import { action } from '@uibakery/data';

function updateLastLoginSupabase() {
  return action('updateLastLoginSupabase', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      UPDATE app_users 
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = {{params.userId}};
    `,
  });
}

export default updateLastLoginSupabase;
