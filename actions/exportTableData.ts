import { action } from '@uibakery/data';

function exportTableData() {
  return action('exportTableData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM {{params.tableName}} 
      ORDER BY id
      LIMIT {{params.limit || 1000}};
    `,
  });
}

export default exportTableData;
