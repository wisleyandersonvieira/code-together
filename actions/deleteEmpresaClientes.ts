import { action } from '@uibakery/data';

function deleteEmpresaClientes() {
  return action('deleteEmpresaClientes', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM empresa_clientes WHERE empresa_id = {{params.empresaId}};
    `,
  });
}

export default deleteEmpresaClientes;
