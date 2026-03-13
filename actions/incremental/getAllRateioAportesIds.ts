import { action } from '@uibakery/data';

function getAllRateioAportesIds() {
  return action('getAllRateioAportesIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM rateio_aportes 
      ORDER BY id;
    `,
  });
}

export default getAllRateioAportesIds;
