import { action } from '@uibakery/data';

function insertBatchData() {
  return action('insertBatchData', 'SQL', {
    databaseName: 'provision',
    query: `
      {{ params.insertQuery }}
    `,
  });
}

export default insertBatchData;
