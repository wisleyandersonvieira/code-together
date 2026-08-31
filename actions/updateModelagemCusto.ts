import { action } from '@uibakery/data';

/**
 * Atualiza um custo adicional. Ver `createModelagemCusto` para categoria/grupo_pai.
 */
function updateModelagemCusto() {
  return action('updateModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_custos SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        label = '{{params.label}}',
        valor = COALESCE({{params.valor}}::decimal, 0),
        distribuicao = '{{params.distribuicao}}',
        mes_ancora = {{params.mesAncora}}::int,
        categoria = COALESCE(NULLIF('{{params.categoria}}', ''), 'outros'),
        -- NULLIF em torno do próprio id: uma linha não pode ser pai de si mesma,
        -- e o ciclo de tamanho 1 é o único que a interface consegue produzir.
        grupo_pai = NULLIF({{params.grupoPaiId}}::int, {{params.id}}::int)
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemCusto;
