import { action } from '@uibakery/data';

function deleteRemovedRecords() {
  return action('deleteRemovedRecords', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM {{params.tableName}}
      WHERE id NOT IN (
        SELECT unnest(ARRAY[{{params.existingIds}}])
      );
    `,
  });
}

export default deleteRemovedRecords;
