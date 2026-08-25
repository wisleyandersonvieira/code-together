import { action } from '@uibakery/data';

function saveJornada() {
  return action('saveJornada', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_jornada(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb,
        {{ params && params.userId ? Number(params.userId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default saveJornada;
