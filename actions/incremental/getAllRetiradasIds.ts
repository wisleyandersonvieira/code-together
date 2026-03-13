import { action } from '@uibakery/data';

function getAllRetiradasIds() {
  return action('getAllRetiradasIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM retiradas 
      ORDER BY id;
    `,
  });
}

export default getAllRetiradasIds;
