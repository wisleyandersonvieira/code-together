import { action } from '@uibakery/data';

function extractGrupos() {
  return action('extractGrupos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM grupos
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractGrupos;
