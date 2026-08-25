import { action } from '@uibakery/data';

/** Item de checklist avulso, que vale só para aquele cliente. */
function saveJornadaItemChecklist() {
  return action('saveJornadaItemChecklist', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_jornada_item_checklist(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb
      ) AS result;
    `,
  });
}

export default saveJornadaItemChecklist;
