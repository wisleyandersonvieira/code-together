import { action } from '@uibakery/data';

function getAllContasIds() {
  return action('getAllContasIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM contas 
      ORDER BY id;
    `,
  });
}

export default getAllContasIds;
