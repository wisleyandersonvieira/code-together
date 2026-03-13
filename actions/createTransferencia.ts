import { action } from '@uibakery/data';

function createTransferencia() {
  return action('createTransferencia', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO transferencias 
        (conta_origem_id, conta_destino_id, valor, data_transferencia, observacoes)
      VALUES 
        ({{params.conta_origem_id}}, {{params.conta_destino_id}}, {{params.valor}}, '{{params.data_transferencia}}'::date, '{{params.observacoes}}')
      RETURNING id;
    `,
  });
}

export default createTransferencia;
