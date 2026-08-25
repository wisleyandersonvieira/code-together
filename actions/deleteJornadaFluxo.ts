import { action } from '@uibakery/data';

function deleteJornadaFluxo() {
  return action('deleteJornadaFluxo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.delete_jornada_fluxo(
        {{ params && params.id ? Number(params.id) : "NULL" }}
      ) AS result;
    `,
  });
}

export default deleteJornadaFluxo;
