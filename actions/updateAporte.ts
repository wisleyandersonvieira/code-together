import { action } from '@uibakery/data';

function updateAporte() {
  return action('updateAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE aportes 
      SET 
        socio_id = {{params.socioId}}::int,
        matriz_id = {{params.matrizId}}::int,
        conta_id = {{params.contaId}}::int,
        data_aporte = {{params.dataAporte}}::date,
        valor = {{params.valor}}::decimal,
        observacoes = {{params.observacoes}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}::int;
    `,
  });
}

export default updateAporte;
