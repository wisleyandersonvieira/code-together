import { action } from '@uibakery/data';

function testBasicConnection() {
  return action('testBasicConnection', 'SQL', {
    databaseName: 'provision',
    query: `SELECT 1 as test;`,
  });
}

export default testBasicConnection;
