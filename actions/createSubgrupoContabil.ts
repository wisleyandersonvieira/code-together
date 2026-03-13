import { action } from '@uibakery/data';

function createSubgrupoContabil() {
  return action('createSubgrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO subgrupos_contabeis (descricao, grupo_id, funcao)
      VALUES ('{{params.descricao}}', {{params.grupoId}}, '{{params.funcao}}')
      RETURNING *;
    `,
  });
}

export default createSubgrupoContabil;
