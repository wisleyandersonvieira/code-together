import { action } from '@uibakery/data';

function loadAllSubgruposContabeis() {
  return action('loadAllSubgruposContabeis', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        sc.*,
        gc.descricao as grupo_nome
      FROM subgrupos_contabeis sc
      INNER JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
      ORDER BY gc.descricao, sc.descricao;
    `,
  });
}

export default loadAllSubgruposContabeis;
