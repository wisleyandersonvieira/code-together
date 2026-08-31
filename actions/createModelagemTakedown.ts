import { action } from '@uibakery/data';

/**
 * Cria um lote de venda (takedown).
 *
 * `preco_unitario = 0` significa "usar o preço da tipologia" — ver o COMMENT da
 * coluna na migration 1761800000. O total do lote NUNCA é gravado: sai do motor.
 */
function createModelagemTakedown() {
  return action('createModelagemTakedown', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_takedowns (
        modelagem_id, unidade_id, fase_id, ordem, mes, quantidade, preco_unitario, observacao
      ) VALUES (
        {{params.modelagemId}}::int,
        {{params.unidadeId}}::int,
        {{params.faseId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        GREATEST(1, COALESCE({{params.mes}}::int, 1)),
        GREATEST(1, COALESCE({{params.quantidade}}::int, 1)),
        COALESCE({{params.precoUnitario}}::decimal, 0),
        '{{params.observacao}}'
      ) RETURNING id
    `,
  });
}

export default createModelagemTakedown;
