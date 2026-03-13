import { action } from '@uibakery/data';

function loadProdutos() {
  return action('loadProdutos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.*,
        g.descricao as grupo_descricao,
        s.descricao as subgrupo_descricao
      FROM produtos p
      LEFT JOIN grupos_contabeis g ON p.grupo_id = g.id
      LEFT JOIN subgrupos_contabeis s ON p.subgrupo_id = s.id
      WHERE 1 = 1
        {{ params && params.searchDescricao ? "AND p.descricao ILIKE '%" + params.searchDescricao + "%'" : "" }}
        {{ params && params.searchGrupo ? "AND p.grupo_id = " + params.searchGrupo : "" }}
        {{ params && params.searchSubgrupo ? "AND p.subgrupo_id = " + params.searchSubgrupo : "" }}
      ORDER BY p.descricao;
    `,
  });
}

export default loadProdutos;
