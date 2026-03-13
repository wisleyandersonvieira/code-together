import { action } from '@uibakery/data';

function loadTiposDocumento() {
  return action('loadTiposDocumento', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM tipos_documento
      WHERE 1 = 1
        {{ params && params.searchDescricao ? "AND descricao ILIKE '%" + params.searchDescricao + "%'" : "" }}
      ORDER BY codigo;
    `,
  });
}

export default loadTiposDocumento;
