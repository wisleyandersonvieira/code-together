import { action } from '@uibakery/data';

function deleteJornadaEtapa() {
  return action('deleteJornadaEtapa', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.delete_jornada_etapa(
        {{ params && params.id ? Number(params.id) : "NULL" }}
      ) AS result;
    `,
  });
}

export default deleteJornadaEtapa;
