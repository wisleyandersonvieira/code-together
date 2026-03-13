import { action } from '@uibakery/data';

function loadContaPagarOrcamentoAlocacoes() {
  return action('loadContaPagarOrcamentoAlocacoes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        cpoa.*,
        o.description as orcamento_description,
        o.value as orcamento_valor_total,
        o.projeto_id,
        f.name as fornecedor_nome
      FROM conta_pagar_orcamento_alocacao cpoa
      JOIN orcamentos o ON cpoa.orcamento_id = o.id
      LEFT JOIN fornecedores f ON o.fornecedor_id = f.id
      WHERE cpoa.conta_pagar_id = {{params.contaPagarId}}
      ORDER BY o.projeto_id, o.predicted_date, o.description;
    `,
  });
}

export default loadContaPagarOrcamentoAlocacoes;
