import { action } from '@uibakery/data';

function checkProdutoUsage() {
  return action('checkProdutoUsage', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        'contas_pagar_itens' as table_name,
        COUNT(*) as count
      FROM contas_pagar_itens 
      WHERE produto_id = {{params.id}}
      
      UNION ALL
      
      SELECT 
        'contas_receber_itens' as table_name,
        COUNT(*) as count
      FROM contas_receber_itens 
      WHERE produto_id = {{params.id}};
    `,
  });
}

export default checkProdutoUsage;
