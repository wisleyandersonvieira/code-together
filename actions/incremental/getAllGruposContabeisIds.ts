import { action } from '@uibakery/data';

function getAllGruposContabeisIds() {
  return action('getAllGruposContabeisIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM grupos_contabeis 
      ORDER BY id;
    `,
  });
}

export default getAllGruposContabeisIds;
