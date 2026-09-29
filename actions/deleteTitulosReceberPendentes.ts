import { action } from '@uibakery/data';

function deleteTitulosReceberPendentes() {
  return action('deleteTitulosReceberPendentes', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM titulos_receber
      WHERE conta_receber_id = {{params.contaReceberId}}
        AND COALESCE(status, 'PENDENTE') <> 'RECEBIDO';
    `,
  });
}

export default deleteTitulosReceberPendentes;
