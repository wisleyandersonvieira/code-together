import { action } from '@uibakery/data';

function insertGenericSimple() {
  return action('insertGenericSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO {{params.tableName}} ({{params.fields}})
      VALUES ({{params.values}})
      ON CONFLICT (id) DO UPDATE SET
        {{params.updateColumns}},
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertGenericSimple;
