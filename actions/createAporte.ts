import { action } from '@uibakery/data';

function createAporte() {
  return action('createAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO aportes (socio_id, matriz_id, conta_id, data_aporte, valor, observacoes)
      VALUES (
        {{params.socioId}}::int,
        {{params.matrizId}}::int, 
        {{params.contaId}}::int,
        '{{params.dataAporte}}'::date,
        {{params.valor}}::decimal,
        '{{params.observacoes}}'
      );
    `,
  });
}

export default createAporte;
