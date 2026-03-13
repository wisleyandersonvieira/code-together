import { action } from '@uibakery/data';

function getAllProjetosIds() {
  return action('getAllProjetosIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM projetos 
      ORDER BY id;
    `,
  });
}

export default getAllProjetosIds;
