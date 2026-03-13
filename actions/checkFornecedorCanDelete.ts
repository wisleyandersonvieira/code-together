import { action } from '@uibakery/data';

function checkFornecedorCanDelete() {
  return action('checkFornecedorCanDelete', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        (SELECT COUNT(*) FROM contas_pagar WHERE fornecedor_id = {{params.id}}) as contas_pagar_count,
        (SELECT COUNT(*) FROM orcamentos WHERE fornecedor_id = {{params.id}}) as orcamentos_count,
        (SELECT COUNT(*) FROM contas_pagar WHERE fornecedor_id = {{params.id}}) + 
        (SELECT COUNT(*) FROM orcamentos WHERE fornecedor_id = {{params.id}}) as total_count;
    `,
  });
}

export default checkFornecedorCanDelete;
