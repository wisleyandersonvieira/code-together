import { action } from '@uibakery/data';

function extractFornecedores() {
  return action('extractFornecedores', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM fornecedores
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractFornecedores;
