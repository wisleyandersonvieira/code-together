import { action } from '@uibakery/data';

function getModifiedRecordsFromTable() {
  return action('getModifiedRecordsFromTable', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM users
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 100)
      OFFSET COALESCE({{params.offset}}::int, 0);
    `,
  });
}

export default getModifiedRecordsFromTable;
