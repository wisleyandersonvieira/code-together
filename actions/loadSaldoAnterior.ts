import { action } from '@uibakery/data';

function loadSaldoAnterior() {
  return action('loadSaldoAnterior', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH movimentacoes AS (
        -- Contas a Pagar pagas antes do período — usa tp.valor_pago (sem JOIN multiplicador)
        SELECT -tp.valor_pago::numeric(15,2) AS valor
        FROM titulos_pagar tp
        WHERE tp.conta_id = {{params.contaId}}
          AND tp.status = 'PAGO'
          AND tp.data_pagamento IS NOT NULL
          {{ params.dataInicio ? "AND tp.data_pagamento < '" + params.dataInicio + "'::date" : "" }}

        UNION ALL

        -- Contas a Receber recebidas antes do período — usa tr.valor_recebido (sem JOIN multiplicador)
        SELECT tr.valor_recebido::numeric(15,2) AS valor
        FROM titulos_receber tr
        WHERE tr.conta_id = {{params.contaId}}
          AND tr.status = 'RECEBIDO'
          AND tr.data_recebimento IS NOT NULL
          {{ params.dataInicio ? "AND tr.data_recebimento < '" + params.dataInicio + "'::date" : "" }}

        UNION ALL

        -- Transferências de Saída antes do período
        SELECT -t.valor::numeric(15,2) AS valor
        FROM transferencias t
        WHERE t.conta_origem_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia < '" + params.dataInicio + "'::date" : "" }}

        UNION ALL

        -- Transferências de Entrada antes do período
        SELECT t.valor::numeric(15,2) AS valor
        FROM transferencias t
        WHERE t.conta_destino_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia < '" + params.dataInicio + "'::date" : "" }}

        UNION ALL

        -- Aportes antes do período
        SELECT a.valor::numeric(15,2) AS valor
        FROM aportes a
        WHERE a.conta_id = {{params.contaId}}
          AND a.data_aporte IS NOT NULL
          {{ params.dataInicio ? "AND a.data_aporte < '" + params.dataInicio + "'::date" : "" }}

        UNION ALL

        -- Retiradas antes do período
        SELECT -r.valor::numeric(15,2) AS valor
        FROM retiradas r
        WHERE r.conta_id = {{params.contaId}}
          AND r.data_retirada IS NOT NULL
          {{ params.dataInicio ? "AND r.data_retirada < '" + params.dataInicio + "'::date" : "" }}
      ),
      saldo_conta AS (
        SELECT
          COALESCE(c.saldo_inicial, 0)::numeric(15,2) AS saldo_inicial,
          c.data_saldo_inicial,
          c.nome  AS conta_nome,
          c.banco AS conta_banco
        FROM contas c
        WHERE c.id = {{params.contaId}}
      )
      SELECT
        (sc.saldo_inicial + COALESCE(SUM(m.valor), 0))::numeric(15,2) AS saldo_anterior,
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
