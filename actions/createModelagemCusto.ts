import { action } from '@uibakery/data';

function createModelagemCusto() {
  return action('createModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_custos (modelagem_id, ordem, label, valor, distribuicao, mes_ancora)
      VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.label}}',
        COALESCE({{params.valor}}::decimal, 0),
        COALESCE('{{params.distribuicao}}', 'linear_construction'),
        {{params.mesAncora}}::int
      ) RETURNING id
    `,
  });
}

export default createModelagemCusto;
