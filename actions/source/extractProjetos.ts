import { action } from '@uibakery/data';

function extractProjetos() {
  return action('extractProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projetos
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractProjetos;
