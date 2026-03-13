import { action } from '@uibakery/data';

function getAllOrcamentosIds() {
  return action('getAllOrcamentosIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM orcamentos 
      ORDER BY id;
    `,
  });
}

export default getAllOrcamentosIds;
