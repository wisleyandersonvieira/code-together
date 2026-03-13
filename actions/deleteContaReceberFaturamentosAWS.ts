import { action } from '@uibakery/data';

function deleteContaReceberFaturamentosAWS() {
  return action('deleteContaReceberFaturamentosAWS', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_receber_faturamento 
      WHERE conta_receber_id = {{ contaReceberId }};
    `,
  });
}

export default deleteContaReceberFaturamentosAWS;

