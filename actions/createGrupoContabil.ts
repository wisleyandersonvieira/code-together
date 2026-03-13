import { action } from '@uibakery/data';

function createGrupoContabil() {
  return action('createGrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupos_contabeis (descricao, tipo)
      VALUES ('{{params.descricao}}', '{{params.tipo}}')
      RETURNING *;
    `,
  });
}

export default createGrupoContabil;
