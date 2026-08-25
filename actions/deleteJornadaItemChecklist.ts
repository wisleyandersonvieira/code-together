import { action } from '@uibakery/data';

function deleteJornadaItemChecklist() {
  return action('deleteJornadaItemChecklist', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.delete_jornada_item_checklist(
        {{ params && params.id ? Number(params.id) : "NULL" }}
      ) AS result;
    `,
  });
}

export default deleteJornadaItemChecklist;
