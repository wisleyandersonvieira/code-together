import { action } from '@uibakery/data';

function createContaReceber() {
  return action('createContaReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH conta_inserted AS (
        INSERT INTO contas_receber (
          matriz_id, 
          cliente_id, 
          entity_type, 
          entity_id, 
          tipo_documento_id, 
          numero_documento, 
          data_emissao, 
          data_vencimento, 
          data_competencia,
          observacoes, 
          valor_total, 
          status
        ) VALUES (
          {{params.matriz_id}}, 
          CASE 
            WHEN '{{params.entity_type}}' = 'cliente' THEN {{params.entity_id}}
            ELSE NULL
          END,
          '{{params.entity_type}}', 
          {{params.entity_id}}, 
          {{ params.tipo_documento_id ? params.tipo_documento_id : "NULL" }}, 
          {{ params.numero_documento ? "'" + params.numero_documento + "'" : "NULL" }},
          '{{params.data_emissao}}'::date, 
          '{{params.data_vencimento}}'::date, 
          '{{params.data_competencia}}'::date,
          {{ params.observacoes ? "'" + params.observacoes + "'" : "NULL" }}, 
          {{params.valor_total}}, 
          'PENDENTE'
        ) RETURNING id
      )
      SELECT id FROM conta_inserted;
    `,
  });
}

export default createContaReceber;
