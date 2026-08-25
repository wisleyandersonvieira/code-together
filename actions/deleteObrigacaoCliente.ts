import { action } from '@uibakery/data';

function deleteObrigacaoCliente() {
  return action('deleteObrigacaoCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.delete_obrigacao_cliente(
        {{ params && params.id ? Number(params.id) : "NULL" }}
      ) AS result;
    `,
  });
}

export default deleteObrigacaoCliente;
