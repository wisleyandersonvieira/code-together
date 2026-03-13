import { action } from '@uibakery/data';

function extractTitulosPagar() {
  return action('extractTitulosPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM titulos_pagar
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractTitulosPagar;
