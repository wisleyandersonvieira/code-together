import { action } from '@uibakery/data';

function extractGruposContabeis() {
  return action('extractGruposContabeis', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM grupos_contabeis
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractGruposContabeis;
