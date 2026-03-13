import { action } from '@uibakery/data';

function extractMatrizes() {
  return action('extractMatrizes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM matrizes
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractMatrizes;
