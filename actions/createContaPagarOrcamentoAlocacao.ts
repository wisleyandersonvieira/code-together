import { action } from '@uibakery/data';

function createContaPagarOrcamentoAlocacao() {
  return action('createContaPagarOrcamentoAlocacao', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO conta_pagar_orcamento_alocacao (conta_pagar_id, orcamento_id, valor_alocado, observacoes)
      VALUES ({{params.conta_pagar_id}}, {{params.orcamento_id}}, {{params.valor_alocado}}, {{ params.observacoes ? "'" + params.observacoes + "'" : "NULL" }})
      ON CONFLICT (conta_pagar_id, orcamento_id) 
      DO UPDATE SET 
        valor_alocado = EXCLUDED.valor_alocado,
        observacoes = {{ params.observacoes ? "'" + params.observacoes + "'" : "NULL" }},
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default createContaPagarOrcamentoAlocacao;
