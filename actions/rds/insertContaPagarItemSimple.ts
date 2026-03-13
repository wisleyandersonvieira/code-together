import { action } from '@uibakery/data';

function insertContaPagarItemSimple() {
  return action('insertContaPagarItemSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_pagar_itens (
        id, conta_pagar_id, produto_id, quantidade, valor_unitario, valor_total, created_at
      ) VALUES (
        {{params.id}}, {{params.conta_pagar_id}}, {{params.produto_id}}, 
        {{params.quantidade}}, {{params.valor_unitario}}, {{params.valor_total}}, 
        COALESCE('{{params.created_at}}'::timestamp, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        conta_pagar_id = EXCLUDED.conta_pagar_id,
        produto_id = EXCLUDED.produto_id,
        quantidade = EXCLUDED.quantidade,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_total = EXCLUDED.valor_total;
    `,
  });
}

export default insertContaPagarItemSimple;
