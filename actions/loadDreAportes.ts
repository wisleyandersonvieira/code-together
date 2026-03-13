import { action } from '@uibakery/data';

function loadDreAportes() {
  return action('loadDreAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id,
        matriz_id,
        valor,
        data_aporte as data_referencia
      FROM aportes
      WHERE 
        matriz_id = {{params.matrizId}}
        AND data_aporte BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}';
    `,
  });
}

export default loadDreAportes;
