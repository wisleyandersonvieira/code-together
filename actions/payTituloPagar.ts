import { action } from '@uibakery/data';

function payTituloPagar() {
  return action('payTituloPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE titulos_pagar 
      SET 
        status = 'PAGO',
        valor_pago = {{params.valor_pago}},
        data_pagamento = '{{params.data_pagamento}}'::date,
        conta_id = {{ params.conta_id ? params.conta_id : "NULL" }},
        observacoes_pagamento = {{ params.observacoes_pagamento ? "'" + params.observacoes_pagamento + "'" : "NULL" }},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default payTituloPagar;
