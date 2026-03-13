import { action } from '@uibakery/data';

function deleteContaPagarOrcamentoAlocacoes() {
  return action('deleteContaPagarOrcamentoAlocacoes', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM conta_pagar_orcamento_alocacao 
      WHERE conta_pagar_id = {{params.contaPagarId}};
    `,
  });
}

export default deleteContaPagarOrcamentoAlocacoes;
