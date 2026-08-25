import { action } from '@uibakery/data';

function saveObrigacaoCatalogo() {
  return action('saveObrigacaoCatalogo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_obrigacao_catalogo(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb
      ) AS result;
    `,
  });
}

export default saveObrigacaoCatalogo;
