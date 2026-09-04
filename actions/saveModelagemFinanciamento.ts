import { action } from '@uibakery/data';

/**
 * Atualiza UMA facilidade de crédito.
 *
 * Deixou de ser 1:1 com a migration 1764200000: a modelagem pode ter várias, e
 * por isso o UPDATE precisa do `id` da facilidade. O `modelagem_id` continua no
 * WHERE — não é redundância defensiva à toa: sem ele, um `id` de outra modelagem
 * (parâmetro trocado na tela, cenário recarregado no meio) gravaria por cima da
 * facilidade de um projeto que não está aberto, e nada acusaria.
 *
 * A facilidade continua sendo criada junto com a modelagem (`createModelagem`),
 * então o caminho comum é UPDATE. As facilidades adicionais nascem em
 * `createModelagemFacilidade`.
 */
function saveModelagemFinanciamento() {
  return action('saveModelagemFinanciamento', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_financiamento SET
        -- Identidade da facilidade (1764200000). "ordem" DEFINE o resultado —
        -- é a precedência da demanda de caixa dentro do mês —, então gravá-la
        -- errado não é problema de exibição.
        ordem = COALESCE({{params.ordem}}::int, 0),
        nome = COALESCE(NULLIF('{{params.nome}}', ''), 'Financiamento'),
        ativo = COALESCE({{params.ativo}}::boolean, TRUE),
        -- Auto-referência na MESMA tabela: nulo = não refinancia ninguém, e é o
        -- estado de toda linha já gravada. A tela manda o ID da facilidade
        -- refinanciada; o motor trabalha por índice e a conversão é do mapeador.
        refinancia_facilidade_id = {{params.refinanciaFacilidadeId}}::int,

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

        -- Linha de crédito rotativa (1763300000). Ficou de fora deste UPDATE
        -- quando a migration entrou, então o switch da aba Financiamento nunca
        -- chegava ao banco: gravava, relia o DEFAULT FALSE e voltava desmarcado.
        -- O COALESCE cai em FALSE, que é o DEFAULT da coluna e o comportamento
        -- da linha não rotativa — param ausente não pode ligar a rotativa.
        linha_rotativa = COALESCE({{params.linhaRotativa}}::boolean, FALSE),

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
        AND id = {{params.id}}::int
    `,
  });
}

export default saveModelagemFinanciamento;
