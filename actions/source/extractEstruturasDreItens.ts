import { action } from '@uibakery/data';

function extractEstruturasDreItens() {
  return action('extractEstruturasDreItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM estruturas_dre_itens
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractEstruturasDreItens;
