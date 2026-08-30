import { action } from '@uibakery/data';

/**
 * Atualiza uma parcela já gravada.
 *
 * Mudar `mes` para um mês que já tem parcela viola o UNIQUE da tabela. Quem
 * bloqueia isso é a aba Aportes, ANTES de chamar: a mensagem na tela é melhor do
 * que o erro do banco no meio de um salvamento em lote.
 */
function updateModelagemAporteParcela() {
  return action('updateModelagemAporteParcela', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_aporte_parcelas SET
        mes = GREATEST(1, COALESCE({{params.mes}}::int, mes)),
        valor = COALESCE({{params.valor}}::decimal, 0),
        observacao = NULLIF('{{params.observacao}}', '')
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemAporteParcela;
