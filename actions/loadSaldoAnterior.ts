import { action } from '@uibakery/data';

function loadSaldoAnterior() {
  return action('loadSaldoAnterior', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH movimentacoes AS (
        -- Títulos a Pagar até o dia anterior ao período selecionado - soma dos valores rateados
        SELECT 
          -COALESCE(cpp.valor_rateio, tp.valor_pago)::numeric(15,2) as valor
        FROM titulos_pagar tp
        INNER JOIN contas_pagar cp ON tp.conta_pagar_id = cp.id
        LEFT JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
        WHERE tp.conta_id = {{params.contaId}}
          AND tp.status = 'PAGO'
          AND tp.data_pagamento IS NOT NULL
          {{ params.dataInicio ? "AND tp.data_pagamento < '" + params.dataInicio + "'::date" : "" }}
        
        UNION ALL
        
        -- Títulos a Receber até o dia anterior ao período selecionado - soma dos valores rateados/faturamento
        SELECT 
          COALESCE(crp.valor_rateio, crf.valor_faturamento, tr.valor_recebido)::numeric(15,2) as valor
        FROM titulos_receber tr
        INNER JOIN contas_receber cr ON tr.conta_receber_id = cr.id
        LEFT JOIN contas_receber_projetos crp ON cr.id = crp.conta_receber_id
        LEFT JOIN contas_receber_faturamento crf ON cr.id = crf.conta_receber_id
        WHERE tr.conta_id = {{params.contaId}}
          AND tr.status = 'RECEBIDO'
          AND tr.data_recebimento IS NOT NULL
          {{ params.dataInicio ? "AND tr.data_recebimento < '" + params.dataInicio + "'::date" : "" }}
        
        UNION ALL
        
        -- Transferências de Saída até o dia anterior ao período selecionado
        SELECT -t.valor::numeric(15,2) as valor
        FROM transferencias t
        WHERE t.conta_origem_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia < '" + params.dataInicio + "'::date" : "" }}
        
        UNION ALL
        
        -- Transferências de Entrada até o dia anterior ao período selecionado
        SELECT t.valor::numeric(15,2) as valor
        FROM transferencias t
        WHERE t.conta_destino_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia < '" + params.dataInicio + "'::date" : "" }}
        
        UNION ALL
        
        -- Aportes até o dia anterior ao período selecionado (Entradas - Crédito)
        SELECT a.valor::numeric(15,2) as valor
        FROM aportes a
        WHERE a.conta_id = {{params.contaId}}
          AND a.data_aporte IS NOT NULL
          {{ params.dataInicio ? "AND a.data_aporte < '" + params.dataInicio + "'::date" : "" }}
        
        UNION ALL
        
        -- Retiradas até o dia anterior ao período selecionado (Saídas - Débito)
        SELECT -r.valor::numeric(15,2) as valor
        FROM retiradas r
        WHERE r.conta_id = {{params.contaId}}
          AND r.data_retirada IS NOT NULL
          {{ params.dataInicio ? "AND r.data_retirada < '" + params.dataInicio + "'::date" : "" }}
      ),
      saldo_conta AS (
        SELECT 
          COALESCE(c.saldo_inicial, 0)::numeric(15,2) as saldo_inicial,
          c.data_saldo_inicial,
          c.nome as conta_nome,
          c.banco as conta_banco
        FROM contas c 
        WHERE c.id = {{params.contaId}}
      )
      SELECT 
        (sc.saldo_inicial + COALESCE(SUM(m.valor), 0))::numeric(15,2) as saldo_anterior,
        sc.conta_nome,
        sc.conta_banco,
        sc.data_saldo_inicial
      FROM saldo_conta sc
      LEFT JOIN movimentacoes m ON true
      GROUP BY sc.saldo_inicial, sc.conta_nome, sc.conta_banco, sc.data_saldo_inicial;
    `,
  });
}

export default loadSaldoAnterior;
