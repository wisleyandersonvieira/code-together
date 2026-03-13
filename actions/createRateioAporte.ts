import { action } from '@uibakery/data';

function createRateioAporte() {
  return action('createRateioAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO rateio_aportes (conta_receber_id, aporte_id, valor_rateado)
      VALUES ({{params.contaReceberId}}, {{params.aporteId}}, {{params.valorRateado}})
      RETURNING id, aporte_id, valor_rateado;
    `,
  });
}

export default createRateioAporte;
