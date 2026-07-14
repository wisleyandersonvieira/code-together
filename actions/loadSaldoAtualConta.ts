import { action } from '@uibakery/data';

function loadSaldoAtualConta() {
  return action('loadSaldoAtualConta', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH movimentacoes_acumuladas AS (
        -- Títulos a Pagar até hoje (Saídas - Débito)
        SELECT 
          tp.conta_id,
          -ABS(tp.valor_pago) as valor
        FROM titulos_pagar tp
        WHERE tp.conta_id = {{params.contaId}}
          AND tp.status = 'PAGO'
          AND tp.data_pagamento IS NOT NULL
          AND tp.data_pagamento <= CURRENT_DATE
        
        UNION ALL
        
        -- Títulos a Receber até hoje (Entradas - Crédito)
        SELECT 
          tr.conta_id,
          ABS(tr.valor_recebido) as valor
        FROM titulos_receber tr
        WHERE tr.conta_id = {{params.contaId}}
          AND tr.status = 'RECEBIDO'
          AND tr.data_recebimento IS NOT NULL
          AND tr.data_recebimento <= CURRENT_DATE
        
        UNION ALL
        
        -- Transferências de Saída até hoje (Débito)
        SELECT 
          t.conta_origem_id as conta_id,
          -ABS(t.valor) as valor
        FROM transferencias t
        WHERE t.conta_origem_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          AND t.data_transferencia <= CURRENT_DATE
        
        UNION ALL
        
        -- Transferências de Entrada até hoje (Crédito)
        SELECT 
          t.conta_destino_id as conta_id,
          ABS(t.valor) as valor
        FROM transferencias t
        WHERE t.conta_destino_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          AND t.data_transferencia <= CURRENT_DATE
        
        UNION ALL
        
        -- Aportes até hoje (Entradas - Crédito)
        SELECT 
          a.conta_id,
          ABS(a.valor) as valor
        FROM aportes a
        WHERE a.conta_id = {{params.contaId}}
          AND a.data_aporte IS NOT NULL
          AND a.data_aporte <= CURRENT_DATE
        
        UNION ALL
        
        -- Retiradas até hoje (Saídas - Débito)
        SELECT 
          r.conta_id,
          -ABS(r.valor) as valor
        FROM retiradas r
        WHERE r.conta_id = {{params.contaId}}
          AND r.data_retirada IS NOT NULL
          AND r.data_retirada <= CURRENT_DATE

        UNION ALL

        -- Empréstimos até hoje (Saídas - Débito)
        SELECT
          e.conta_id,
          -ABS(e.valor) as valor
        FROM emprestimos e
        WHERE e.conta_id = {{params.contaId}}
          AND e.tipo = 'EMPRESTIMO'
          AND e.data_emprestimo IS NOT NULL
          AND e.data_emprestimo <= CURRENT_DATE

        UNION ALL

        -- Pagamentos de Empréstimo até hoje (Entradas - Crédito)
        SELECT
          e.conta_id,
          ABS(e.valor) as valor
        FROM emprestimos e
        WHERE e.conta_id = {{params.contaId}}
          AND e.tipo = 'PAGAMENTO'
          AND e.data_emprestimo IS NOT NULL
          AND e.data_emprestimo <= CURRENT_DATE
      ),
      saldo_conta AS (
        SELECT 
          c.id,
          c.nome,
          c.banco,
          c.numero,
          COALESCE(c.saldo_inicial, 0) as saldo_inicial,
          c.data_saldo_inicial
        FROM contas c 
        WHERE c.id = {{params.contaId}}
      )
      SELECT 
        sc.id,
        sc.nome,
        sc.banco,
        sc.numero,
        sc.saldo_inicial,
        sc.data_saldo_inicial,
        COALESCE(SUM(m.valor), 0) as total_movimentos,
        (sc.saldo_inicial + COALESCE(SUM(m.valor), 0)) as saldo_atual
      FROM saldo_conta sc
      LEFT JOIN movimentacoes_acumuladas m ON sc.id = m.conta_id
      GROUP BY sc.id, sc.nome, sc.banco, sc.numero, sc.saldo_inicial, sc.data_saldo_inicial;
    `,
  });
}

export default loadSaldoAtualConta;
