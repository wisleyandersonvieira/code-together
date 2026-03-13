import { action } from '@uibakery/data';

function createMatrizSocio() {
  return action('createMatrizSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO matriz_socios (matriz_id, socio_id, percentual_participacao)
      VALUES ({{params.matrizId}}, {{params.socioId}}, {{params.percentualParticipacao}})
      RETURNING id;
    `,
  });
}

export default createMatrizSocio;
