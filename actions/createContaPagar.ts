import { action } from '@uibakery/data';

function createContaPagar() {
  return action('createContaPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH conta_inserted AS (
        INSERT INTO contas_pagar (
          matriz_id, fornecedor_id, tipo_documento_id, numero_documento, 
          data_emissao, data_vencimento, data_competencia,
          observacoes, valor_total, status
        ) VALUES (
          {{params.matriz_id}}, 
          {{ params.fornecedor_id && params.fornecedor_id > 0 ? params.fornecedor_id : "NULL" }}, 
          {{params.tipo_documento_id}}, 
          '{{params.numero_documento}}',
          '{{params.data_emissao}}', 
          '{{params.data_vencimento}}', 
          '{{params.data_competencia}}',
          {{ params.observacoes ? "'" + params.observacoes.replace(/'/g, "''") + "'" : "NULL" }}, 
          {{params.valor_total}}, 
          'PENDENTE'
        ) RETURNING id
      )
      SELECT id FROM conta_inserted;
    `,
  });
}

export default createContaPagar;
