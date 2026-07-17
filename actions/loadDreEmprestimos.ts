import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento } from '@/lib/sql-filters';

// Retorna o campo tipo para o DRE separar EMPRESTIMO (saída) de PAGAMENTO (entrada)
function loadDreEmprestimos() {
  return action('loadDreEmprestimos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        id,
        matriz_id,
        conta_id,
        tipo,
        valor,
        data_emprestimo as data_referencia
      FROM emprestimos
      WHERE
        data_emprestimo BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}'
        ${andIdIn('matriz_id', 'matrizIds')}
        ${andIdInWhenPagamento('conta_id', 'contaIds')};
    `,
  });
}

export default loadDreEmprestimos;
