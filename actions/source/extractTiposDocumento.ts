import { action } from '@uibakery/data';

function extractTiposDocumento() {
  return action('extractTiposDocumento', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM tipos_documento
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractTiposDocumento;
