import { action } from '@uibakery/data';

function createTituloReceberSimple() {
  return action('createTituloReceberSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO titulos_receber (
        conta_receber_id, 
        parcela, 
        total_parcelas, 
        data_vencimento, 
        valor, 
        status
      )
      VALUES (
        {{params.conta_receber_id}}, 
        {{params.parcela}}, 
        {{params.total_parcelas}}, 
        '{{params.data_vencimento}}'::date, 
        {{params.valor}}, 
        'PENDENTE'
      )
      RETURNING id, conta_receber_id, parcela, valor;
    `,
  });
}

export default createTituloReceberSimple;
