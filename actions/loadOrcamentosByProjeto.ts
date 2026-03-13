import { action } from '@uibakery/data';

function loadOrcamentosByProjeto() {
  return action('loadOrcamentosByProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        oe.id,
        oe.projeto_id,
        oe.description,
        oe.fornecedor_id,
        f.name as fornecedor_nome,
        oe.predicted_date,
        oe.valor_orcado,
        oe.valor_executado,
        oe.valor_saldo
      FROM orcamentos_executado oe
      LEFT JOIN fornecedores f ON oe.fornecedor_id = f.id
      WHERE oe.projeto_id = {{params.projetoId}}
      ORDER BY oe.predicted_date, oe.description;
    `,
  });
}

export default loadOrcamentosByProjeto;
