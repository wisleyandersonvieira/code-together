import { action } from '@uibakery/data';

function insertEmpresaClienteSimple() {
  return action('insertEmpresaClienteSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO empresa_clientes (id, empresa_id, cliente_id)
      VALUES ({{params.id}}, {{params.empresa_id || 1}}, {{params.cliente_id || 1}})
      ON CONFLICT (id) DO UPDATE SET
        empresa_id = EXCLUDED.empresa_id,
        cliente_id = EXCLUDED.cliente_id;
    `,
  });
}

export default insertEmpresaClienteSimple;
