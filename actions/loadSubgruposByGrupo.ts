import { action } from '@uibakery/data';

function loadSubgruposByGrupo() {
  return action('loadSubgruposByGrupo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM subgrupos_contabeis 
      WHERE grupo_id = {{params.grupo_id}}
      ORDER BY descricao;
    `,
  });
}

export default loadSubgruposByGrupo;
