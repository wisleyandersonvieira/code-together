import { action } from '@uibakery/data';

/**
 * Cria uma parcela de um custo com gatilho 'mes_fixo' (migration 1763000000).
 *
 * INSERT seco, sem ON CONFLICT: a tabela NÃO tem UNIQUE (custo_id, mes), porque
 * duas parcelas no mesmo mês são legítimas e o motor soma — como já acontece com
 * takedowns. É o oposto de `createModelagemAporteParcela`, onde o UNIQUE existe.
 *
 * `custoId` precisa existir: a parcela de um custo recém-criado só pode ser
 * gravada DEPOIS que o INSERT do custo devolveu o id. Quem garante a ordem é o
 * `salvar()` do ModelagemEditor.
 *
 * `mes` é ÍNDICE do cronograma (1..N), nunca data. Mês acima do prazo é gravado
 * assim mesmo: fica guardado, inativo, e a conferência acusa — nunca apagado.
 */
function createModelagemCustoParcela() {
  return action('createModelagemCustoParcela', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_custo_parcelas (modelagem_id, custo_id, ordem, mes, valor)
      VALUES (
        {{params.modelagemId}}::int,
        {{params.custoId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        GREATEST(1, COALESCE({{params.mes}}::int, 1)),
        COALESCE({{params.valor}}::decimal, 0)
      ) RETURNING id
    `,
  });
}

export default createModelagemCustoParcela;
