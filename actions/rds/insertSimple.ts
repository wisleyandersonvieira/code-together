import { action } from '@uibakery/data';

function insertSimple() {
  return action('insertSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO {{params.tableName}} ({{params.columns}})
      VALUES ({{params.values}})
      ON CONFLICT (id) DO UPDATE SET
        {{params.updateColumns}},
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertSimple;
