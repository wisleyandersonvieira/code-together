import { action } from '@uibakery/data';

function extractEmpresaClientes() {
  return action('extractEmpresaClientes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM empresa_clientes
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractEmpresaClientes;
