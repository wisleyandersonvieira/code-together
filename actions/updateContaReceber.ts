import { action } from '@uibakery/data';

function updateContaReceber() {
  return action('updateContaReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE contas_receber 
      SET 
        matriz_id = {{params.matriz_id}},
        cliente_id = CASE 
          WHEN {{params.entity_type}} = 'cliente' THEN {{params.entity_id}}
          ELSE NULL
        END,
        entity_type = {{params.entity_type}},
        entity_id = {{params.entity_id}},
        tipo_documento_id = {{params.tipo_documento_id}},
        numero_documento = {{params.numero_documento}},
        data_emissao = {{params.data_emissao}},
        data_vencimento = {{params.data_vencimento}},
        data_competencia = {{params.data_competencia}},
        observacoes = {{params.observacoes}},
        valor_total = {{params.valor_total}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default updateContaReceber;
