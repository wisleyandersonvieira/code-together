import { action } from '@uibakery/data';

function insertRateioAporteSimple() {
  return action('insertRateioAporteSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO rateio_aportes (
        id, aporte_id, entity_type, entity_id, percentual, valor_rateio, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.aporte_id}}, {{params.entity_type}}, {{params.entity_id}}, 
        {{params.percentual}}, {{params.valor_rateio}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        aporte_id = EXCLUDED.aporte_id,
        entity_type = EXCLUDED.entity_type,
        entity_id = EXCLUDED.entity_id,
        percentual = EXCLUDED.percentual,
        valor_rateio = EXCLUDED.valor_rateio,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertRateioAporteSimple;
