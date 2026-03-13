import { action } from '@uibakery/data';

function extractProjetoMembers() {
  return action('extractProjetoMembers', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projeto_members
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractProjetoMembers;
