import { action } from '@uibakery/data';

function getAllAportesIds() {
  return action('getAllAportesIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM aportes 
      ORDER BY id;
    `,
  });
}

export default getAllAportesIds;
