import { action } from '@uibakery/data';

function loadPrevisaoAportesWithRateio() {
  return action('loadPrevisaoAportesWithRateio', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pa.id,
        pa.projeto_id,
        pa.membro_id,
        pa.data_previsao,
        pa.valor_previsto,
        pa.observacoes,
        COALESCE(SUM(ra.valor_rateado), 0) as valor_rateado_total,
        COUNT(ra.id) as total_rateios
      FROM previsao_aportes pa
      LEFT JOIN rateio_aportes ra ON pa.id = ra.aporte_id
      WHERE pa.projeto_id = {{params.projetoId}}
      GROUP BY pa.id, pa.projeto_id, pa.membro_id, pa.data_previsao, pa.valor_previsto, pa.observacoes
      ORDER BY pa.data_previsao, pa.membro_id;
    `,
  });
}

export default loadPrevisaoAportesWithRateio;
