import { action } from '@uibakery/data';

function debugTaxaAdm() {
  return action('debugTaxaAdm', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        sc.id,
        sc.descricao,
        sc.funcao,
        sc.grupo_id,
        gc.descricao as grupo_nome
      FROM subgrupos_contabeis sc
      INNER JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
      WHERE sc.descricao = 'Taxa Adm'
      ORDER BY sc.id;
    `,
  });
}

export default debugTaxaAdm;
