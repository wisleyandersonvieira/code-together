import { action } from '@uibakery/data';

function extractMatrizSocios() {
  return action('extractMatrizSocios', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM matriz_socios
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractMatrizSocios;
