import { action } from '@uibakery/data';

function insertContaReceberItemSimple() {
  return action('insertContaReceberItemSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_receber_itens (
        id, conta_receber_id, produto_id, quantidade, valor_unitario, valor_total, created_at
      ) VALUES (
        {{params.id}}, {{params.conta_receber_id}}, {{params.produto_id}}, 
        {{params.quantidade}}, {{params.valor_unitario}}, {{params.valor_total}}, 
        COALESCE('{{params.created_at}}'::timestamp, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        conta_receber_id = EXCLUDED.conta_receber_id,
        produto_id = EXCLUDED.produto_id,
        quantidade = EXCLUDED.quantidade,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_total = EXCLUDED.valor_total;
    `,
  });
}

export default insertContaReceberItemSimple;
