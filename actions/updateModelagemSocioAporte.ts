import { action } from '@uibakery/data';

/**
 * Atualiza um aporte já gravado.
 *
 * Mover o aporte para um mês que já tem outro NÃO é erro: a tabela não tem
 * UNIQUE (socio_id, mes) e o motor soma os dois. Não há nada para a interface
 * bloquear antes de chamar — ao contrário de `updateModelagemAporteParcela`.
 */
function updateModelagemSocioAporte() {
  return action('updateModelagemSocioAporte', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_socio_aportes SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        mes = GREATEST(1, COALESCE({{params.mes}}::int, mes)),
        valor = COALESCE({{params.valor}}::decimal, 0),
        observacao = NULLIF('{{params.observacao}}', '')
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemSocioAporte;
