import { action } from '@uibakery/data';

function deleteProduto() {
  return action('deleteProduto', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM produtos 
      WHERE id = {{params.id}}
      AND NOT EXISTS (SELECT 1 FROM contas_pagar_itens WHERE produto_id = {{params.id}})
      AND NOT EXISTS (SELECT 1 FROM contas_receber_itens WHERE produto_id = {{params.id}})
      RETURNING id, descricao;
    `,
  });
}

export default deleteProduto;
