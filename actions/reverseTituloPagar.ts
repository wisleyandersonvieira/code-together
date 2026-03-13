import { action } from '@uibakery/data';

function reverseTituloPagar() {
  return action('reverseTituloPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE titulos_pagar 
      SET 
        status = 'PENDENTE',
        valor_pago = 0,
        data_pagamento = NULL,
        conta_id = NULL,
        observacoes_pagamento = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default reverseTituloPagar;
