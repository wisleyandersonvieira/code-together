import { action } from '@uibakery/data';

function getAllSubgruposContabeisIds() {
  return action('getAllSubgruposContabeisIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM subgrupos_contabeis 
      ORDER BY id;
    `,
  });
}

export default getAllSubgruposContabeisIds;
