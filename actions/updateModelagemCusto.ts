import { action } from '@uibakery/data';

function updateModelagemCusto() {
  return action('updateModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_custos SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        label = '{{params.label}}',
        valor = COALESCE({{params.valor}}::decimal, 0),
        distribuicao = '{{params.distribuicao}}',
        mes_ancora = {{params.mesAncora}}::int
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemCusto;
