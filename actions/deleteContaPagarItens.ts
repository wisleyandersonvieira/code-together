import { action } from '@uibakery/data';

function deleteContaPagarItens() {
  return action('deleteContaPagarItens', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_pagar_itens
      WHERE conta_pagar_id = {{params.contaPagarId}};
    `,
  });
}

export default deleteContaPagarItens;
