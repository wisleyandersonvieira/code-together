import { action } from '@uibakery/data';

function updateTransferencia() {
  return action('updateTransferencia', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE transferencias 
      SET 
        conta_origem_id = {{params.conta_origem_id}},
        conta_destino_id = {{params.conta_destino_id}},
        valor = {{params.valor}},
        data_transferencia = '{{params.data_transferencia}}'::date,
        observacoes = '{{params.observacoes}}',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id;
    `,
  });
}

export default updateTransferencia;
