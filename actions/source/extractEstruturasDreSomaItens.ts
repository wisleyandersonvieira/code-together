import { action } from '@uibakery/data';

function extractEstruturasDreSomaItens() {
  return action('extractEstruturasDreSomaItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM estruturas_dre_soma_itens
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractEstruturasDreSomaItens;
