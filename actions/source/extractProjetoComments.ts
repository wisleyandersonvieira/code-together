import { action } from '@uibakery/data';

function extractProjetoComments() {
  return action('extractProjetoComments', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projeto_comments
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractProjetoComments;
