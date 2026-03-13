import { action } from '@uibakery/data';

function getProjetoColumnHistoryModified() {
  return action('getProjetoColumnHistoryModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projeto_column_history
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getProjetoColumnHistoryModified;
