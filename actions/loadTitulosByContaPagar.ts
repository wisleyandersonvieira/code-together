import { action } from '@uibakery/data';

function loadTitulosByContaPagar() {
  return action('loadTitulosByContaPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        tp.*,
        c.nome as conta_nome,
        c.banco,
        CASE 
          WHEN tp.status = 'pago' OR tp.data_pagamento IS NOT NULL OR (tp.valor_pago IS NOT NULL AND tp.valor_pago >= tp.valor) THEN 'pago'
          WHEN tp.data_vencimento < CURRENT_DATE AND (tp.status != 'pago' AND tp.data_pagamento IS NULL) THEN 'vencido'
          ELSE 'pendente'
        END as status_calculado
      FROM titulos_pagar tp
      LEFT JOIN contas c ON tp.conta_id = c.id
      WHERE tp.conta_pagar_id = {{params.contaPagarId}}
      ORDER BY tp.parcela, tp.data_vencimento;
    `,
  });
}

export default loadTitulosByContaPagar;
