import { action } from '@uibakery/data';

function extractParametros() {
  return action('extractParametros', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM parametros
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractParametros;
