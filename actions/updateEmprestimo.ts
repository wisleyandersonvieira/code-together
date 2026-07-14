import { action } from '@uibakery/data';

function updateEmprestimo() {
  return action('updateEmprestimo', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE emprestimos
      SET
        tipo = '{{params.tipo}}',
        socio_id = {{params.socioId}}::int,
        matriz_id = {{params.matrizId}}::int,
        conta_id = {{params.contaId}}::int,
        data_emprestimo = {{params.dataEmprestimo}}::date,
        valor = {{params.valor}}::decimal,
        observacoes = {{params.observacoes}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}::int;
    `,
  });
}

export default updateEmprestimo;
