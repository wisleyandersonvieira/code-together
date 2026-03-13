import { action } from '@uibakery/data';

function getUsersModified() {
  return action('getUsersModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM users
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getUsersModified;
