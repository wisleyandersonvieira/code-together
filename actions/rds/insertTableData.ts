import { action } from '@uibakery/data';

function insertTableData() {
  return action('insertTableData', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO {{params.tableName}} ({{params.columns}})
      VALUES {{params.values}}
      ON CONFLICT (id) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertTableData;
