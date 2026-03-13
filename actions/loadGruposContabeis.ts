import { action } from '@uibakery/data';

function loadGruposContabeis() {
  return action('loadGruposContabeis', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM grupos_contabeis 
      ORDER BY tipo, descricao;
    `,
  });
}

export default loadGruposContabeis;
