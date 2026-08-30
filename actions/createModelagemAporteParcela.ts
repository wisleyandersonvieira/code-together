import { action } from '@uibakery/data';

/**
 * Cria a parcela de um mês — na prática um UPSERT por (modelagem_id, mes).
 *
 * O ON CONFLICT não é conveniência: a linha do fluxo de caixa grava na hora, sem
 * esperar o botão salvar, e nada garante que aquele mês ainda não tem parcela. Um
 * INSERT seco estouraria no UNIQUE em cima do usuário, no meio da edição.
 *
 * `mes` é ÍNDICE do cronograma (1..N), nunca data.
 */
function createModelagemAporteParcela() {
  return action('createModelagemAporteParcela', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_aporte_parcelas (modelagem_id, mes, valor, observacao)
      VALUES (
        {{params.modelagemId}}::int,
        GREATEST(1, COALESCE({{params.mes}}::int, 1)),
        COALESCE({{params.valor}}::decimal, 0),
        NULLIF('{{params.observacao}}', '')
      )
      ON CONFLICT (modelagem_id, mes)
      DO UPDATE SET
        valor = EXCLUDED.valor,
        observacao = EXCLUDED.observacao
      RETURNING id
    `,
  });
}

export default createModelagemAporteParcela;
