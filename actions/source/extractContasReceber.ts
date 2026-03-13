import { action } from '@uibakery/data';

function extractContasReceber() {
  return action('extractContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_receber
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContasReceber;
