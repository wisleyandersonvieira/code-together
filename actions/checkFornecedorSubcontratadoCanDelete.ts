import { action } from '@uibakery/data';

function checkFornecedorSubcontratadoCanDelete() {
  return action('checkFornecedorSubcontratadoCanDelete', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        (SELECT COUNT(*) FROM auditoria_fornecedor_itens WHERE fornecedor_subcontratado_id = {{params.id}}) AS auditorias_count;
    `,
  });
}

export default checkFornecedorSubcontratadoCanDelete;
