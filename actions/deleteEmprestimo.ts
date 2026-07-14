import { action } from '@uibakery/data';

function deleteEmprestimo() {
  return action('deleteEmprestimo', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM emprestimos WHERE id = {{params.id}}::int;
    `,
  });
}

export default deleteEmprestimo;
