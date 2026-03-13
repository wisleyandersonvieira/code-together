import { action } from '@uibakery/data';

function deletePrevisaoAportesSemRateio() {
  return action('deletePrevisaoAportesSemRateio', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM previsao_aportes 
      WHERE projeto_id = {{params.projetoId}}
        AND id NOT IN (
          SELECT DISTINCT aporte_id 
          FROM rateio_aportes 
          WHERE aporte_id IS NOT NULL
        )
      RETURNING id;
    `,
  });
}

export default deletePrevisaoAportesSemRateio;
