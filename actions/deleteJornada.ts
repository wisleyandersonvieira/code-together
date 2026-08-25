import { action } from '@uibakery/data';

function deleteJornada() {
  return action('deleteJornada', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.delete_jornada(
        {{ params && params.id ? Number(params.id) : "NULL" }}
      ) AS result;
    `,
  });
}

export default deleteJornada;
