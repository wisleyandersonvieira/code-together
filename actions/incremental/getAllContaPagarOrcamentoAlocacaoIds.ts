import { action } from '@uibakery/data';

function getAllContaPagarOrcamentoAlocacaoIds() {
  return action('getAllContaPagarOrcamentoAlocacaoIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM conta_pagar_orcamento_alocacao 
      ORDER BY id;
    `,
  });
}

export default getAllContaPagarOrcamentoAlocacaoIds;
