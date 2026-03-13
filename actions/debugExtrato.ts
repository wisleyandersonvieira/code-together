import { action } from '@uibakery/data';

function debugExtrato() {
  return action('debugExtrato', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM (
        -- Check Títulos a Pagar
        SELECT 'CP' as tipo, tp.data_pagamento, tp.data_pagamento::text as data_texto, tp.status, tp.conta_id
        FROM titulos_pagar tp
        WHERE tp.data_pagamento IS NOT NULL
        LIMIT 5
      ) AS cp_data
      
      UNION ALL
      
      SELECT * FROM (
        -- Check Títulos a Receber  
        SELECT 'CR' as tipo, tr.data_recebimento, tr.data_recebimento::text as data_texto, tr.status, tr.conta_id
        FROM titulos_receber tr
        WHERE tr.data_recebimento IS NOT NULL
        LIMIT 5
      ) AS cr_data
      
      UNION ALL
      
      SELECT * FROM (
        -- Check Transferências
        SELECT 'TR' as tipo, t.data_transferencia, t.data_transferencia::text as data_texto, 'ACTIVE' as status, t.conta_origem_id as conta_id
        FROM transferencias t
        WHERE t.data_transferencia IS NOT NULL
        LIMIT 5
      ) AS tr_data
      
      UNION ALL
      
      SELECT * FROM (
        -- Check Aportes
        SELECT 'APORTE' as tipo, a.data_aporte, a.data_aporte::text as data_texto, 'ACTIVE' as status, a.conta_id
        FROM aportes a
        WHERE a.data_aporte IS NOT NULL
        LIMIT 5
      ) AS aporte_data
      
      UNION ALL
      
      SELECT * FROM (
        -- Check Retiradas
        SELECT 'RETIRADA' as tipo, r.data_retirada, r.data_retirada::text as data_texto, 'ACTIVE' as status, r.conta_id
        FROM retiradas r
        WHERE r.data_retirada IS NOT NULL
        LIMIT 5
      ) AS retirada_data;
    `,
  });
}

export default debugExtrato;
