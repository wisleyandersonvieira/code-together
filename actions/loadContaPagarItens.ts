import { action } from '@uibakery/data';

function loadContaPagarItens() {
  return action('loadContaPagarItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT *
      FROM contas_pagar_itens
      WHERE conta_pagar_id = {{params.contaPagarId}}
      ORDER BY id;
    `,
  });
}

export default loadContaPagarItens;
