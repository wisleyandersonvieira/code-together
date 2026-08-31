import { action } from '@uibakery/data';

/**
 * Cria um custo adicional.
 *
 * `categoria` cai em 'outros' quando não vier — o mesmo default da coluna
 * (migration 1761200000), e o que preserva o comportamento anterior.
 * `grupo_pai` é hierarquia visual e aceita NULL: linha de primeiro nível.
 *
 * `base_calculo` cai em 'total', que é o default da coluna (migration 1761300000):
 * com ele, `valor` continua sendo o total digitado, como sempre foi. Nas demais
 * bases quem vale é `valor_unitario` — e o total derivado NUNCA é gravado.
 *
 * `grupo_referencia` e `percentual` só valem com base_calculo = 'pct_de_grupo';
 * a constraint modelagem_custos_pct_grupo_ck exige o grupo nesse caso, e a
 * interface sempre o preenche ao trocar a base.
 *
 * `gatilho` cai em 'cronograma', o default da coluna (migration 1761500000): o
 * lançamento continua saindo de `distribuicao`/`mes_ancora`, como sempre foi.
 */
function createModelagemCusto() {
  return action('createModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_custos (
        modelagem_id, ordem, label, valor, distribuicao, mes_ancora, categoria, grupo_pai,
        base_calculo, valor_unitario, grupo_referencia, percentual, gatilho
      ) VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.label}}',
        COALESCE({{params.valor}}::decimal, 0),
        COALESCE('{{params.distribuicao}}', 'linear_construction'),
        {{params.mesAncora}}::int,
        COALESCE(NULLIF('{{params.categoria}}', ''), 'outros'),
        {{params.grupoPaiId}}::int,
        COALESCE(NULLIF('{{params.baseCalculo}}', ''), 'total'),
        COALESCE({{params.valorUnitario}}::decimal, 0),
        -- O NULLIF duplo é deliberado: grupoReferencia é nulo em toda linha que
        -- não é percentual, e um null interpolado dentro de aspas chegaria aqui
        -- como o TEXTO 'null', que furaria modelagem_custos_grupo_ref_ck.
        NULLIF(NULLIF('{{params.grupoReferencia}}', ''), 'null'),
        COALESCE({{params.percentual}}::decimal, 0),
        COALESCE(NULLIF('{{params.gatilho}}', ''), 'cronograma')
      ) RETURNING id
    `,
  });
}

export default createModelagemCusto;
