import { action } from '@uibakery/data';

/**
 * Cabeçalho do plano de aportes. Uma linha por modelagem.
 *
 * Diferente de `saveModelagemFinanciamento`, aqui é INSERT ... ON CONFLICT: a
 * linha nasce com a migration 1761000000 para as modelagens antigas, mas uma
 * modelagem criada depois dela ainda não tem linha nenhuma — e o UPDATE puro
 * sumiria em silêncio.
 */
function saveModelagemAportes() {
  return action('saveModelagemAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_aportes (
        modelagem_id, modo_aporte, aporte_base_total, valor_total_alvo, regra_rateio_capital
      )
      VALUES (
        {{params.modelagemId}}::int,
        '{{params.modoAporte}}',
        COALESCE({{params.aporteBaseTotal}}::decimal, 0),
        COALESCE({{params.valorTotalAlvo}}::decimal, 0),
        -- 'participacao' é o default da coluna (migration 1763100000) e o rateio
        -- de sempre: uma chamada que não informe a regra não muda o resultado.
        COALESCE(NULLIF('{{params.regraRateioCapital}}', ''), 'participacao')
      )
      ON CONFLICT (modelagem_id)
      DO UPDATE SET
        modo_aporte = EXCLUDED.modo_aporte,
        aporte_base_total = EXCLUDED.aporte_base_total,
        valor_total_alvo = EXCLUDED.valor_total_alvo,
        regra_rateio_capital = EXCLUDED.regra_rateio_capital,
        updated_at = CURRENT_TIMESTAMP
    `,
  });
}

export default saveModelagemAportes;
