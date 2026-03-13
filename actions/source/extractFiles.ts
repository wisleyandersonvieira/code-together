import { action } from '@uibakery/data';

function extractFiles() {
  return action('extractFiles', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM files
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractFiles;
