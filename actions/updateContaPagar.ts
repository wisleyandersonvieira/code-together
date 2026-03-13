import { action } from '@uibakery/data';

function updateContaPagar() {
  return action('updateContaPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH conta_atualizada AS (
        UPDATE contas_pagar 
        SET 
          matriz_id = {{params.matriz_id || null}},
          fornecedor_id = {{params.fornecedor_id || null}},
          tipo_documento_id = {{params.tipo_documento_id || null}},
          numero_documento = '{{params.numero_documento || ''}}',
          data_emissao = '{{params.data_emissao}}',
          data_vencimento = '{{params.data_vencimento}}',
          data_competencia = '{{params.data_competencia}}',
          observacoes = {{params.observacoes && params.observacoes.trim() !== '' ? "'" + params.observacoes.replace(/'/g, "''") + "'" : "NULL"}},
          valor_total = {{params.valor_total || 0}},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = {{params.id}}
        RETURNING id, valor_total
      )
      UPDATE titulos_pagar 
      SET 
        valor = (conta_atualizada.valor_total / titulos_pagar.total_parcelas),
        updated_at = CURRENT_TIMESTAMP
      FROM conta_atualizada
      WHERE titulos_pagar.conta_pagar_id = conta_atualizada.id
        AND titulos_pagar.status = 'PENDENTE';
    `,
  });
}

export default updateContaPagar;
