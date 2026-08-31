import { action } from '@uibakery/data';

/**
 * Cria um custo adicional.
 *
 * `categoria` cai em 'outros' quando não vier — o mesmo default da coluna
 * (migration 1761200000), e o que preserva o comportamento anterior.
 * `grupo_pai` é hierarquia visual e aceita NULL: linha de primeiro nível.
 */
function createModelagemCusto() {
  return action('createModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_custos (
        modelagem_id, ordem, label, valor, distribuicao, mes_ancora, categoria, grupo_pai
      ) VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.label}}',
        COALESCE({{params.valor}}::decimal, 0),
        COALESCE('{{params.distribuicao}}', 'linear_construction'),
        {{params.mesAncora}}::int,
        COALESCE(NULLIF('{{params.categoria}}', ''), 'outros'),
        {{params.grupoPaiId}}::int
      ) RETURNING id
    `,
  });
}

export default createModelagemCusto;
