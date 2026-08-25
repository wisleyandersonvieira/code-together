import { action } from '@uibakery/data';

function saveJornadaFluxo() {
  return action('saveJornadaFluxo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_jornada_fluxo(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb
      ) AS result;
    `,
  });
}

export default saveJornadaFluxo;
