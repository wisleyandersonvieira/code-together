import { action } from '@uibakery/data';

function extractAportes() {
  return action('extractAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM aportes
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractAportes;
