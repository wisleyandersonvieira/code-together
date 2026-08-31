import { action } from '@uibakery/data';

/** Atualiza um lote de venda. Ver `createModelagemTakedown`. */
function updateModelagemTakedown() {
  return action('updateModelagemTakedown', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_takedowns SET
        unidade_id = {{params.unidadeId}}::int,
        fase_id = {{params.faseId}}::int,
        ordem = COALESCE({{params.ordem}}::int, ordem),
        mes = GREATEST(1, COALESCE({{params.mes}}::int, 1)),
        quantidade = GREATEST(1, COALESCE({{params.quantidade}}::int, 1)),
        preco_unitario = COALESCE({{params.precoUnitario}}::decimal, 0),
        observacao = '{{params.observacao}}'
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemTakedown;
