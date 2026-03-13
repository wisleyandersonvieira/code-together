import { action } from '@uibakery/data';

function testSupabaseConnection() {
  return action('testSupabaseConnection', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      SELECT COUNT(*) as total_app_users
      FROM app_users;
    `,
  });
}

export default testSupabaseConnection;

