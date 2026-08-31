import { action } from '@uibakery/data';

/**
 * Cria um aporte de capital de um sócio (migration 1763100000).
 *
 * INSERT seco, sem ON CONFLICT: a tabela NÃO tem UNIQUE (socio_id, mes), porque
 * dois aportes do mesmo sócio no mesmo mês são legítimos e o motor soma — como já
 * acontece com takedowns e com as parcelas de custo.
 *
 * `socioId` precisa existir: o aporte de um sócio recém-criado só pode ser
 * gravado DEPOIS que o INSERT do sócio devolveu o id. Quem garante a ordem é o
 * `salvar()` do ModelagemEditor.
 *
 * `mes` é ÍNDICE do cronograma (1..N), nunca data. Mês acima do prazo é gravado
 * assim mesmo: fica guardado, inativo, e a conferência acusa — nunca apagado.
 */
function createModelagemSocioAporte() {
  return action('createModelagemSocioAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_socio_aportes (modelagem_id, socio_id, ordem, mes, valor, observacao)
      VALUES (
        {{params.modelagemId}}::int,
        {{params.socioId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        GREATEST(1, COALESCE({{params.mes}}::int, 1)),
        COALESCE({{params.valor}}::decimal, 0),
        NULLIF('{{params.observacao}}', '')
      ) RETURNING id
    `,
  });
}

export default createModelagemSocioAporte;
