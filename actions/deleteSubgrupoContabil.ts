import { action } from '@uibakery/data';

function deleteSubgrupoContabil() {
  return action('deleteSubgrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM subgrupos_contabeis 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteSubgrupoContabil;
