import { action } from '@uibakery/data';

/**
 * Premissas da operação e da saída (migration 1764100000).
 *
 * Linha 1:1 com a modelagem, criada junto com ela quando o tipo é 'locacao'. O
 * UPSERT cobre a modelagem que trocou de tipo por SQL administrativo e ainda não
 * tem cabeçalho — sem ele, o UPDATE não acharia linha e a tela gravaria no vazio.
 *
 * `ocupacao_estabilizada_pct` cai em 1, e não em 0: é o DEFAULT da coluna, e uma
 * ocupação estabilizada zerada faria o NOI de referência ser negativo (só OPEX)
 * e o valor de saída, zero.
 */
function saveModelagemLocacao() {
  return action('saveModelagemLocacao', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_locacao (
        modelagem_id, taxa_reembolso_pct, perda_credito_pct, cap_rate_saida,
        custo_venda_pct, noi_referencia, ocupacao_estabilizada_pct
      ) VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.taxaReembolsoPct}}::decimal, 0),
        COALESCE({{params.perdaCreditoPct}}::decimal, 0),
        COALESCE({{params.capRateSaida}}::decimal, 0),
        COALESCE({{params.custoVendaPct}}::decimal, 0),
        COALESCE(NULLIF('{{params.noiReferencia}}', ''), 'estabilizado'),
        COALESCE({{params.ocupacaoEstabilizadaPct}}::decimal, 1)
      )
      ON CONFLICT (modelagem_id) DO UPDATE SET
        taxa_reembolso_pct = EXCLUDED.taxa_reembolso_pct,
        perda_credito_pct = EXCLUDED.perda_credito_pct,
        cap_rate_saida = EXCLUDED.cap_rate_saida,
        custo_venda_pct = EXCLUDED.custo_venda_pct,
        noi_referencia = EXCLUDED.noi_referencia,
        ocupacao_estabilizada_pct = EXCLUDED.ocupacao_estabilizada_pct,
        updated_at = CURRENT_TIMESTAMP
    `,
  });
}

export default saveModelagemLocacao;
