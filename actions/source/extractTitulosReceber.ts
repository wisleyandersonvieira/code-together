import { action } from '@uibakery/data';

function extractTitulosReceber() {
  return action('extractTitulosReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM titulos_receber
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractTitulosReceber;
