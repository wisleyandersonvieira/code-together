import { action } from '@uibakery/data';

function deleteMatrizSocios() {
  return action('deleteMatrizSocios', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM matriz_socios 
      WHERE matriz_id = {{params.matrizId}};
    `,
  });
}

export default deleteMatrizSocios;
