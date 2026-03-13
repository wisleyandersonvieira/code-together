import { action } from '@uibakery/data';

function extractContasPagar() {
  return action('extractContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_pagar
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContasPagar;
