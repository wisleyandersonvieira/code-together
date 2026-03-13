import { action } from '@uibakery/data';

function createEmpresaClientes() {
  return action('createEmpresaClientes', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO empresa_clientes (empresa_id, cliente_id, percentage)
      VALUES ({{params.empresaId}}, {{params.clienteId}}, {{params.percentage}});
    `,
  });
}

export default createEmpresaClientes;
