import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento } from '@/lib/sql-filters';

// Retorna o campo tipo para o DRE separar EMPRESTIMO (saída) de PAGAMENTO (entrada)
function loadDreEmprestimos() {
  return action('loadDreEmprestimos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        e.id,
        e.matriz_id,
        e.conta_id,
        e.tipo,
        e.valor,
        e.data_emprestimo as data_referencia,
        s.nome as socio_nome
      FROM emprestimos e
      LEFT JOIN socios s ON s.id = e.socio_id
      WHERE
        e.data_emprestimo BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}'
        ${andIdIn('e.matriz_id', 'matrizIds')}
        ${andIdInWhenPagamento('e.conta_id', 'contaIds')};
    `,
  });
}

export default loadDreEmprestimos;
