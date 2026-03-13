import { action } from '@uibakery/data';

function extractSocios() {
  return action('extractSocios', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM socios
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractSocios;
