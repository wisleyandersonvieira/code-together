import { action } from '@uibakery/data';

function loadDreRetiradas() {
  return action('loadDreRetiradas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id,
        matriz_id,
        valor,
        data_retirada as data_referencia
      FROM retiradas
      WHERE 
        matriz_id = {{params.matrizId}}
        AND data_retirada BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}';
    `,
  });
}

export default loadDreRetiradas;
