import { action } from '@uibakery/data';

/**
 * Atualiza uma parcela já gravada.
 *
 * Diferente de `updateModelagemAporteParcela`, mover a parcela para um mês que já
 * tem outra NÃO é erro: a tabela não tem UNIQUE (custo_id, mes) e o motor soma as
 * duas. Não há nada para a interface bloquear antes de chamar.
 */
function updateModelagemCustoParcela() {
  return action('updateModelagemCustoParcela', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_custo_parcelas SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        mes = GREATEST(1, COALESCE({{params.mes}}::int, mes)),
        valor = COALESCE({{params.valor}}::decimal, 0)
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemCustoParcela;
