import { action } from '@uibakery/data';

function createContaPagarItem() {
  return action('createContaPagarItem', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_pagar_itens (conta_pagar_id, produto_id, quantidade, valor_unitario, valor_total)
      VALUES ({{params.conta_pagar_id}}, {{params.produto_id}}, {{params.quantidade}}, {{params.valor_unitario}}, {{params.valor_total}});
    `,
  });
}

export default createContaPagarItem;
