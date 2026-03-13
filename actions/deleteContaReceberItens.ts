import { action } from '@uibakery/data';

function deleteContaReceberItens() {
  return action('deleteContaReceberItens', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_receber_itens WHERE conta_receber_id = {{params.contaReceberId}};
    `,
  });
}

export default deleteContaReceberItens;
