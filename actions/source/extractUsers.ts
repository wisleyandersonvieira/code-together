import { action } from '@uibakery/data';

function extractUsers() {
  return action('extractUsers', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM users
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractUsers;
