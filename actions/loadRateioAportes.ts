import { action } from '@uibakery/data';

function loadRateioAportes() {
  return action('loadRateioAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        ra.id,
        ra.aporte_id,
        ra.valor_rateado,
        pa.membro_id,
        pa.data_previsao,
        pa.valor_previsto
      FROM rateio_aportes ra
      INNER JOIN previsao_aportes pa ON ra.aporte_id = pa.id
      WHERE ra.conta_receber_id = {{params.contaReceberId}}
      ORDER BY pa.data_previsao, pa.membro_id;
    `,
  });
}

export default loadRateioAportes;
