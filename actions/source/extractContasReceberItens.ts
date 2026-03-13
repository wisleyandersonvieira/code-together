import { action } from '@uibakery/data';

function extractContasReceberItens() {
  return action('extractContasReceberItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_receber_itens
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContasReceberItens;
