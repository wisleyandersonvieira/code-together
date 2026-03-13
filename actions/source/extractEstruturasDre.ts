import { action } from '@uibakery/data';

function extractEstruturasDre() {
  return action('extractEstruturasDre', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM estruturas_dre
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractEstruturasDre;
