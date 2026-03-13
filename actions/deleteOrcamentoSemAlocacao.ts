import { action } from '@uibakery/data';

function deleteOrcamentoSemAlocacao() {
  return action('deleteOrcamentoSemAlocacao', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM orcamentos 
      WHERE id = {{params.orcamentoId}}
      AND NOT EXISTS (
        SELECT 1 FROM conta_pagar_orcamento_alocacao 
        WHERE orcamento_id = {{params.orcamentoId}} 
        AND valor_alocado > 0
      );
    `,
  });
}

export default deleteOrcamentoSemAlocacao;
