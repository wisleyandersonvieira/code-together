import { action } from '@uibakery/data';

function createRetirada() {
  return action('createRetirada', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO retiradas (socio_id, matriz_id, conta_id, data_retirada, valor, observacoes)
      VALUES (
        {{params.socioId}}::int,
        {{params.matrizId}}::int, 
        {{params.contaId}}::int,
        '{{params.dataRetirada}}'::date,
        {{params.valor}}::decimal,
        '{{params.observacoes}}'
      );
    `,
  });
}

export default createRetirada;
