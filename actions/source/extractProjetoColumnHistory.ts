import { action } from '@uibakery/data';

function extractProjetoColumnHistory() {
  return action('extractProjetoColumnHistory', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projeto_column_history
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractProjetoColumnHistory;
