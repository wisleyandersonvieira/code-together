import { action } from '@uibakery/data';

function extractProdutos() {
  return action('extractProdutos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM produtos
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractProdutos;
