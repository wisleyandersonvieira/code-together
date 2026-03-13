import { action } from '@uibakery/data';

function extractContasPagarItens() {
  return action('extractContasPagarItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_pagar_itens
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContasPagarItens;
