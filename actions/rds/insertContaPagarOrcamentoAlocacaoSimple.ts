import { action } from '@uibakery/data';

function insertContaPagarOrcamentoAlocacaoSimple() {
  return action('insertContaPagarOrcamentoAlocacaoSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO conta_pagar_orcamento_alocacao (
        id, conta_pagar_id, orcamento_id, valor_alocado, percentual, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.conta_pagar_id}}, {{params.orcamento_id}}, {{params.valor_alocado}}, 
        {{params.percentual}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        conta_pagar_id = EXCLUDED.conta_pagar_id,
        orcamento_id = EXCLUDED.orcamento_id,
        valor_alocado = EXCLUDED.valor_alocado,
        percentual = EXCLUDED.percentual,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertContaPagarOrcamentoAlocacaoSimple;
