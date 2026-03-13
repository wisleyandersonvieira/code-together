import { action } from '@uibakery/data';

function insertAporteSimple() {
  return action('insertAporteSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO aportes (id, socio_id, matriz_id, conta_id, data_aporte, valor, observacoes)
      VALUES ({{params.id}}, {{params.socio_id || params.entity_id || 1}}, {{params.matriz_id || 1}}, {{params.conta_id || 1}}, {{params.data_aporte ? "'" + params.data_aporte + "'" : params.date ? "'" + params.date + "'" : "CURRENT_DATE"}}, {{params.valor || params.value || 0}}, '{{params.observacoes || params.description || ""}}')
      ON CONFLICT (id) DO UPDATE SET
        socio_id = EXCLUDED.socio_id,
        matriz_id = EXCLUDED.matriz_id,
        conta_id = EXCLUDED.conta_id,
        data_aporte = EXCLUDED.data_aporte,
        valor = EXCLUDED.valor,
        observacoes = EXCLUDED.observacoes,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertAporteSimple;
