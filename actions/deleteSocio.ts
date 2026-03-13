import { action } from '@uibakery/data';

function deleteSocio() {
  return action('deleteSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM socios 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteSocio;
