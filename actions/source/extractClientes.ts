import { action } from '@uibakery/data';

function extractClientes() {
  return action('extractClientes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM clientes
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractClientes;
