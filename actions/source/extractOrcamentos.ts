import { action } from '@uibakery/data';

function extractOrcamentos() {
  return action('extractOrcamentos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM orcamentos
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractOrcamentos;
