import { action } from '@uibakery/data';

function toggleJornadaChecklist() {
  return action('toggleJornadaChecklist', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.toggle_jornada_item_checklist(
        {{ params && params.id ? Number(params.id) : "NULL" }},
        {{ params && params.concluido ? "TRUE" : "FALSE" }},
        {{ params && params.userId ? Number(params.userId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default toggleJornadaChecklist;
