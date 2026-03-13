import { action } from '@uibakery/data';

function getTableCount() {
  return action('getTableCount', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT COUNT(*) as record_count
      FROM {{params.tableName}};
    `,
  });
}

export default getTableCount;
