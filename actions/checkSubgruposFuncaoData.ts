import { action } from '@uibakery/data';

function checkSubgruposFuncaoData() {
  return action('checkSubgruposFuncaoData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        sc.id,
        sc.descricao,
        sc.funcao,
        sc.grupo_id,
        gc.descricao as grupo_nome,
        gc.tipo as grupo_tipo
      FROM subgrupos_contabeis sc
      INNER JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
      ORDER BY sc.descricao ASC;
    `,
  });
}

export default checkSubgruposFuncaoData;
