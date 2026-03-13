import { action } from '@uibakery/data';

function saveRateioAportes() {
  return action('saveRateioAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Delete existing allocations for this conta_receber_id first
      DELETE FROM rateio_aportes 
      WHERE conta_receber_id = {{params.contaReceberId}};
    `,
  });
}

export default saveRateioAportes;
