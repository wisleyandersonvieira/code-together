import { action } from '@uibakery/data';

function extractContas() {
  return action('extractContas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContas;
