import { action } from '@uibakery/data';

function receiveTituloReceber() {
  return action('receiveTituloReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE titulos_receber 
      SET 
        valor_recebido = {{params.valor_recebido}},
        data_recebimento = '{{params.data_recebimento}}'::date,
        conta_id = {{params.conta_id}},
        observacoes_recebimento = '{{params.observacoes_recebimento}}',
        status = 'RECEBIDO',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default receiveTituloReceber;
