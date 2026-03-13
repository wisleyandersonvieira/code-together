import { action } from '@uibakery/data';

function deleteContaReceberFaturamentos() {
  return action('deleteContaReceberFaturamentos', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_receber_faturamento 
      WHERE conta_receber_id = {{params.contaReceberId}};
    `,
  });
}

export default deleteContaReceberFaturamentos;
