import { action } from '@uibakery/data';

function extractEmpresas() {
  return action('extractEmpresas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM empresas
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractEmpresas;
