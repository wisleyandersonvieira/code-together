import { action } from '@uibakery/data';

function updateRetirada() {
  return action('updateRetirada', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE retiradas 
      SET 
        socio_id = {{params.socioId}}::int,
        matriz_id = {{params.matrizId}}::int,
        conta_id = {{params.contaId}}::int,
        data_retirada = {{params.dataRetirada}}::date,
        valor = {{params.valor}}::decimal,
        observacoes = {{params.observacoes}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}::int;
    `,
  });
}

export default updateRetirada;
