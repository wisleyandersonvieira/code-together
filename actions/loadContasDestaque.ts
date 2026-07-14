import { action } from '@uibakery/data';

function loadContasDestaque() {
  return action('loadContasDestaque', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH movimentacoes_por_conta AS (
        SELECT 
          c.id as conta_id,
          c.nome,
          c.banco,
          c.numero,
          COALESCE(c.saldo_inicial, 0) as saldo_inicial,
          c.data_saldo_inicial,
          COALESCE(SUM(movimentos.valor), 0) as total_movimentos
        FROM contas c
        LEFT JOIN (
          -- Títulos a Pagar (Saídas - Débito)
          SELECT 
            tp.conta_id,
            -ABS(tp.valor_pago) as valor
          FROM titulos_pagar tp
          WHERE tp.status = 'PAGO'
            AND tp.data_pagamento IS NOT NULL
            AND tp.data_pagamento <= CURRENT_DATE
          
          UNION ALL
          
          -- Títulos a Receber (Entradas - Crédito)
          SELECT 
            tr.conta_id,
            ABS(tr.valor_recebido) as valor
          FROM titulos_receber tr
          WHERE tr.status = 'RECEBIDO'
            AND tr.data_recebimento IS NOT NULL
            AND tr.data_recebimento <= CURRENT_DATE
          
          UNION ALL
          
          -- Transferências de Saída (Débito)
          SELECT 
            t.conta_origem_id as conta_id,
            -ABS(t.valor) as valor
          FROM transferencias t
          WHERE t.data_transferencia IS NOT NULL
            AND t.data_transferencia <= CURRENT_DATE
          
          UNION ALL
          
          -- Transferências de Entrada (Crédito)
          SELECT 
            t.conta_destino_id as conta_id,
            ABS(t.valor) as valor
          FROM transferencias t
          WHERE t.data_transferencia IS NOT NULL
            AND t.data_transferencia <= CURRENT_DATE
          
          UNION ALL
          
          -- Aportes (Entradas - Crédito)
          SELECT 
            a.conta_id,
            ABS(a.valor) as valor
          FROM aportes a
          WHERE a.data_aporte IS NOT NULL
            AND a.data_aporte <= CURRENT_DATE
          
          UNION ALL
          
          -- Retiradas (Saídas - Débito)
          SELECT 
            r.conta_id,
            -ABS(r.valor) as valor
          FROM retiradas r
          WHERE r.data_retirada IS NOT NULL
            AND r.data_retirada <= CURRENT_DATE

          UNION ALL

          -- Empréstimos (Saídas - Débito)
          SELECT
            e.conta_id,
            -ABS(e.valor) as valor
          FROM emprestimos e
          WHERE e.tipo = 'EMPRESTIMO'
            AND e.data_emprestimo IS NOT NULL
            AND e.data_emprestimo <= CURRENT_DATE

          UNION ALL

          -- Pagamentos de Empréstimo (Entradas - Crédito)
          SELECT
            e.conta_id,
            ABS(e.valor) as valor
          FROM emprestimos e
          WHERE e.tipo = 'PAGAMENTO'
            AND e.data_emprestimo IS NOT NULL
            AND e.data_emprestimo <= CURRENT_DATE
        ) movimentos ON c.id = movimentos.conta_id
        WHERE c.destaque = TRUE
        GROUP BY c.id, c.nome, c.banco, c.numero, c.saldo_inicial, c.data_saldo_inicial
      )
      SELECT 
        conta_id as id,
        nome,
        banco,
        numero,
        saldo_inicial,
        data_saldo_inicial,
        (saldo_inicial + total_movimentos) as saldo_atual
      FROM movimentacoes_por_conta
      ORDER BY nome;
    `,
  });
}

export default loadContasDestaque;
