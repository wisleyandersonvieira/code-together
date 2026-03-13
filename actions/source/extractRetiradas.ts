import { action } from '@uibakery/data';

function extractRetiradas() {
  return action('extractRetiradas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM retiradas
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractRetiradas;
