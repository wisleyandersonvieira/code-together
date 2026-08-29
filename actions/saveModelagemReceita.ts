import { action } from '@uibakery/data';

/** Linha 1:1 criada junto com a modelagem — sempre UPDATE, nunca INSERT. */
function saveModelagemReceita() {
  return action('saveModelagemReceita', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_receita SET
        comissao_pct = COALESCE({{params.comissaoPct}}::decimal, 0),
        custo_cartorio_pct = COALESCE({{params.custoCartorioPct}}::decimal, 0),
        modo_venda = '{{params.modoVenda}}',
        mes_saida = {{params.mesSaida}}::int,
        lucro_investidores_pct = COALESCE({{params.lucroInvestidoresPct}}::decimal, 0),
        lucro_sponsor_pct = COALESCE({{params.lucroSponsorPct}}::decimal, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE modelagem_id = {{params.modelagemId}}::int
    `,
  });
}

export default saveModelagemReceita;
