import { action } from '@uibakery/data';

function saveJornadaEtapa() {
  return action('saveJornadaEtapa', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_jornada_etapa(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb
      ) AS result;
    `,
  });
}

export default saveJornadaEtapa;
