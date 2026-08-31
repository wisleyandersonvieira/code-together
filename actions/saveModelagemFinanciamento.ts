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

        -- Reserva de juros (1762100000). O DEFAULT de reserva_juros_sacada é
        -- TRUE, então COALESCE precisa cair em TRUE também.
        reserva_juros = COALESCE({{params.reservaJuros}}::decimal, 0),
        reserva_juros_sacada = COALESCE({{params.reservaJurosSacada}}::boolean, TRUE),

        -- Carência, prestação e balloon (1762200000). INERTES desde a
        -- 1763400000, que removeu os modos 'price' e 'sac': continuam sendo
        -- gravados para não perder o que o usuário declarou, e não têm efeito
        -- no cálculo. prazo_meses e
        -- amortizacao_meses aceitam NULL: nulo é "não declarado", não zero.
        prazo_meses = {{params.prazoMeses}}::int,
        carencia_meses = COALESCE({{params.carenciaMeses}}::int, 0),
        amortizacao_meses = {{params.amortizacaoMeses}}::int,
        balloon_no_vencimento = COALESCE({{params.balloonNoVencimento}}::boolean, TRUE),

        -- Release price (1762300000). release_price_pct nulo = não usar; zero
        -- seria 0% de release, que é outra coisa.
        release_price = COALESCE({{params.releasePrice}}::decimal, 0),
        release_price_pct = {{params.releasePricePct}}::decimal,

        -- Convenção e indexação (1762400000 e 1762500000).
        convencao_juros = COALESCE(NULLIF('{{params.convencaoJuros}}', ''), 'mensal_12'),
        tipo_taxa = COALESCE(NULLIF('{{params.tipoTaxa}}', ''), 'fixa'),
        spread = COALESCE({{params.spread}}::decimal, 0),
        benchmark_nome = NULLIF(NULLIF('{{params.benchmarkNome}}', ''), 'null'),
        benchmark_padrao = COALESCE({{params.benchmarkPadrao}}::decimal, 0),

        updated_at = CURRENT_TIMESTAMP
      WHERE modelagem_id = {{params.modelagemId}}::int
    `,
  });
}

export default saveModelagemFinanciamento;
