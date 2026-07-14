import { action } from '@uibakery/data';

// Retorna o campo tipo para o DRE separar EMPRESTIMO (saída) de PAGAMENTO (entrada)
function loadDreEmprestimos() {
  return action('loadDreEmprestimos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        id,
        matriz_id,
        tipo,
        valor,
        data_emprestimo as data_referencia
      FROM emprestimos
      WHERE
        matriz_id = {{params.matrizId}}
        AND data_emprestimo BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}';
    `,
  });
}

export default loadDreEmprestimos;
