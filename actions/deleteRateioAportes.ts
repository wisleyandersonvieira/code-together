import { action } from '@uibakery/data';

function deleteRateioAportes() {
  return action('deleteRateioAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM rateio_aportes 
      WHERE conta_receber_id = {{params.contaReceberId}};
    `,
  });
}

export default deleteRateioAportes;
