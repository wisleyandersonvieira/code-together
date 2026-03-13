import { action } from '@uibakery/data';

function extractContaPagarOrcamentoAlocacao() {
  return action('extractContaPagarOrcamentoAlocacao', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM conta_pagar_orcamento_alocacao
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContaPagarOrcamentoAlocacao;
