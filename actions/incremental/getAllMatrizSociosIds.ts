import { action } from '@uibakery/data';

function getAllMatrizSociosIds() {
  return action('getAllMatrizSociosIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM matriz_socios 
      ORDER BY id;
    `,
  });
}

export default getAllMatrizSociosIds;
