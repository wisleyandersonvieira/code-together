import { action } from '@uibakery/data';

function getUpdatedRecords() {
  return action('getUpdatedRecords', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT COUNT(*) as total_records
      FROM users
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp;
    `,
  });
}

export default getUpdatedRecords;
