import { action } from '@uibakery/data';

/** Linha 1:1 criada junto com a modelagem — sempre UPDATE, nunca INSERT. */
function saveModelagemFinanciamento() {
  return action('saveModelagemFinanciamento', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_financiamento SET
        taxa_anual = COALESCE({{params.taxaAnual}}::decimal, 0),
        fee_estruturacao_pct = COALESCE({{params.feeEstruturacaoPct}}::decimal, 0),
        fee_timing = '{{params.feeTiming}}',
        fee_mes = {{params.feeMes}}::int,
        mes_inicio_saque = COALESCE({{params.mesInicioSaque}}::int, 1),
        mes_fim_saque = COALESCE({{params.mesFimSaque}}::int, 1),
        modo_saque = '{{params.modoSaque}}',
        max_ltc_pct = {{params.maxLtcPct}}::decimal,
        valor_contratado = {{params.valorContratado}}::decimal,
        custo_financeiro_na_demanda = COALESCE({{params.custoFinanceiroNaDemanda}}::boolean, FALSE),
        modo_amortizacao = '{{params.modoAmortizacao}}',
        capitalizar_juros = COALESCE({{params.capitalizarJuros}}::boolean, FALSE),
        colchao_minimo_caixa = COALESCE({{params.colchaoMinimoCaixa}}::decimal, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE modelagem_id = {{params.modelagemId}}::int
    `,
  });
}

export default saveModelagemFinanciamento;
