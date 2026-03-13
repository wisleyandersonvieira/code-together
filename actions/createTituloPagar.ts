import { action } from '@uibakery/data';

function createTituloPagar() {
  return action('createTituloPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO titulos_pagar (conta_pagar_id, parcela, total_parcelas, data_vencimento, valor, status)
      VALUES ({{params.conta_pagar_id}}, {{params.parcela}}, {{params.total_parcelas}}, '{{params.data_vencimento}}', {{params.valor}}, 'PENDENTE');
    `,
  });
}

export default createTituloPagar;
