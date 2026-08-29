import { action } from '@uibakery/data';

/** Mês de venda de uma unidade, usado quando modo_venda = 'per_unit'. */
function saveModelagemVendaUnidade() {
  return action('saveModelagemVendaUnidade', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_vendas_unidade (modelagem_id, unidade_id, mes_venda)
      VALUES ({{params.modelagemId}}::int, {{params.unidadeId}}::int, {{params.mesVenda}}::int)
      ON CONFLICT (modelagem_id, unidade_id)
      DO UPDATE SET mes_venda = EXCLUDED.mes_venda
    `,
  });
}

export default saveModelagemVendaUnidade;
