import { action } from '@uibakery/data';

// Totais do período filtrado (ignora paginação) — usado pelos cards de total
// da listagem de Empréstimos: total de empréstimos, total de pagamentos e
// saldo devedor (empréstimos - pagamentos).
function sumEmprestimos() {
  return action('sumEmprestimos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        COALESCE(SUM(e.valor) FILTER (WHERE e.tipo = 'EMPRESTIMO'), 0)::numeric(15,2) as total_emprestimos,
        COALESCE(SUM(e.valor) FILTER (WHERE e.tipo = 'PAGAMENTO'), 0)::numeric(15,2) as total_pagamentos,
        (
          COALESCE(SUM(e.valor) FILTER (WHERE e.tipo = 'EMPRESTIMO'), 0)
          - COALESCE(SUM(e.valor) FILTER (WHERE e.tipo = 'PAGAMENTO'), 0)
        )::numeric(15,2) as saldo_devedor,
        COUNT(*) as quantidade
      FROM emprestimos e
      WHERE 1 = 1
        {{ params && params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'" : "" }}
        {{ params && params.dataFim ? "AND e.data_emprestimo <= '" + params.dataFim + "'" : "" }}
        {{ params && params.matrizId ? "AND e.matriz_id = " + params.matrizId : "" }}
        {{ params && params.socioId ? "AND e.socio_id = " + params.socioId : "" }}
        {{ params && params.contaId ? "AND e.conta_id = " + params.contaId : "" }}
        {{ params && params.tipo ? "AND e.tipo = '" + params.tipo + "'" : "" }};
    `,
  });
}

export default sumEmprestimos;
