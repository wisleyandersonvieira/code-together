import { action } from '@uibakery/data';

function createTituloReceberSafe() {
  return action('createTituloReceberSafe', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Inserir título com ID seguro gerado dinamicamente
      INSERT INTO titulos_receber (
        id,
        conta_receber_id, 
        parcela, 
        total_parcelas, 
        data_vencimento, 
        valor, 
        status
      )
      VALUES (
        NEXTVAL('titulos_receber_id_seq'),
        {{params.conta_receber_id}}, 
        {{params.parcela}}, 
        {{params.total_parcelas}}, 
        '{{params.data_vencimento}}'::date, 
        {{params.valor}}, 
        'PENDENTE'
      )
      RETURNING id;
    `,
  });
}

export default createTituloReceberSafe;
