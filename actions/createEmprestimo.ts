import { action } from '@uibakery/data';

function createEmprestimo() {
  return action('createEmprestimo', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO emprestimos (tipo, socio_id, matriz_id, conta_id, data_emprestimo, valor, observacoes)
      VALUES (
        '{{params.tipo}}',
        {{params.socioId}}::int,
        {{params.matrizId}}::int,
        {{params.contaId}}::int,
        '{{params.dataEmprestimo}}'::date,
        {{params.valor}}::decimal,
        '{{params.observacoes}}'
      );
    `,
  });
}

export default createEmprestimo;
