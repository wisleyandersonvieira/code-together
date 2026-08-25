import { action } from '@uibakery/data';

function deleteObrigacaoCatalogo() {
  return action('deleteObrigacaoCatalogo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.delete_obrigacao_catalogo(
        {{ params && params.id ? Number(params.id) : "NULL" }}
      ) AS result;
    `,
  });
}

export default deleteObrigacaoCatalogo;
