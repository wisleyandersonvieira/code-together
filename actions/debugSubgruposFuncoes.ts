import { action } from '@uibakery/data';

function debugSubgruposFuncoes() {
  return action('debugSubgruposFuncoes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        sc.id,
        sc.descricao,
        sc.funcao,
        gc.descricao as grupo_nome
      FROM subgrupos_contabeis sc
      INNER JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
      ORDER BY sc.descricao;
    `,
  });
}

export default debugSubgruposFuncoes;
