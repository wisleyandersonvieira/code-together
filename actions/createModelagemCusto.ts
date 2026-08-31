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
 */
function createModelagemCusto() {
  return action('createModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_custos (
        modelagem_id, ordem, label, valor, distribuicao, mes_ancora, categoria, grupo_pai,
        base_calculo, valor_unitario
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
        COALESCE({{params.valorUnitario}}::decimal, 0)
      ) RETURNING id
    `,
  });
}

export default createModelagemCusto;
