import { action } from '@uibakery/data';

function extractPrevisaoAportes() {
  return action('extractPrevisaoAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM previsao_aportes
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractPrevisaoAportes;
