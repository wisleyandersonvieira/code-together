import { action } from '@uibakery/data';

function extractRateioAportes() {
  return action('extractRateioAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM rateio_aportes
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractRateioAportes;
