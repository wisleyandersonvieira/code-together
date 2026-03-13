import { action } from '@uibakery/data';

function extractTableData() {
  return action('extractTableData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM {{params.tableName}}
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractTableData;
