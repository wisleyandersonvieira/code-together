import { action } from '@uibakery/data';

function loadSubgruposContabeis() {
  return action('loadSubgruposContabeis', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT s.*, g.descricao as grupo_descricao, g.tipo as grupo_tipo
      FROM subgrupos_contabeis s
      LEFT JOIN grupos_contabeis g ON s.grupo_id = g.id
      WHERE 1 = 1
      {{ params && params.searchTerm ? "AND s.descricao ILIKE '%" + params.searchTerm + "%'" : "" }}
      {{ params && params.grupoId ? "AND s.grupo_id = " + params.grupoId : "" }}
      ORDER BY g.tipo, g.descricao, s.descricao;
    `,
  });
}

export default loadSubgruposContabeis;
