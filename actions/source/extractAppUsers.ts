import { action } from '@uibakery/data';

function extractAppUsers() {
  return action('extractAppUsers', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM app_users
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractAppUsers;
