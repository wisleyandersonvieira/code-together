import { action } from '@uibakery/data';

function getContaPagarOrcamentoAlocacaoModified() {
  return action('getContaPagarOrcamentoAlocacaoModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM conta_pagar_orcamento_alocacao
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getContaPagarOrcamentoAlocacaoModified;
