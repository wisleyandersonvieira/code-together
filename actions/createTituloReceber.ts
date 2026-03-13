import { action } from '@uibakery/data';

function createTituloReceber() {
  return action('createTituloReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO titulos_receber (conta_receber_id, parcela, total_parcelas, data_vencimento, valor, status)
      VALUES ({{params.conta_receber_id}}, {{params.parcela}}, {{params.total_parcelas}}, '{{params.data_vencimento}}'::date, {{params.valor}}, 'PENDENTE')
      RETURNING id;
    `,
  });
}

export default createTituloReceber;
