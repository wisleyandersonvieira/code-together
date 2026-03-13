import { action } from '@uibakery/data';

function getAllClientesIds() {
  return action('getAllClientesIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM clientes 
      ORDER BY id;
    `,
  });
}

export default getAllClientesIds;
