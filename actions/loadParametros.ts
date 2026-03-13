import { action } from '@uibakery/data';

function loadParametros() {
  return action('loadParametros', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM parametros 
      ORDER BY chave;
    `,
  });
}

export default loadParametros;
