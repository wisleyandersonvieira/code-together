import { action } from '@uibakery/data';

function createContaReceberItem() {
  return action('createContaReceberItem', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_receber_itens (conta_receber_id, produto_id, quantidade, valor_unitario, valor_total)
      VALUES ({{params.conta_receber_id}}, {{params.produto_id}}, {{params.quantidade}}, {{params.valor_unitario}}, {{params.valor_total}})
      RETURNING id;
    `,
  });
}

export default createContaReceberItem;
