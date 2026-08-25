import { action } from '@uibakery/data';

function saveObrigacaoCliente() {
  return action('saveObrigacaoCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT public.save_obrigacao_cliente(
        convert_from(decode({{params.payload}}, 'base64'), 'UTF8')::jsonb,
        {{ params && params.userId ? Number(params.userId) : "NULL" }}
      ) AS result;
    `,
  });
}

export default saveObrigacaoCliente;
