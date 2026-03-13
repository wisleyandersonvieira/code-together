import { action } from '@uibakery/data';

function loadTotalRateadoPorAporte() {
  return action('loadTotalRateadoPorAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pa.id as aporte_id,
        pa.valor_previsto,
        COALESCE(SUM(ra.valor_rateado), 0) as total_rateado,
        (pa.valor_previsto - COALESCE(SUM(ra.valor_rateado), 0)) as saldo_restante
      FROM previsao_aportes pa
      LEFT JOIN rateio_aportes ra ON pa.id = ra.aporte_id
      WHERE pa.projeto_id = {{params.projetoId}}
      GROUP BY pa.id, pa.valor_previsto
      ORDER BY pa.data_previsao, pa.id;
    `,
  });
}

export default loadTotalRateadoPorAporte;
