import { action } from '@uibakery/data';

/** Atualiza uma etapa isolada (usado na jornada, no painel e na caixa de tarefas). */
function saveJornadaItem() {
  return action('saveJornadaItem', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_jornada_item(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb,
        {{ params && params.userId ? Number(params.userId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default saveJornadaItem;
