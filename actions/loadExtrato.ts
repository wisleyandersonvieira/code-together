import { action } from '@uibakery/data';

function loadExtrato() {
  return action('loadExtrato', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH movimentacoes AS (
        -- Contas a Pagar (Saídas) — um registro por PARCELA efetivamente paga
        -- Usa tp.valor_pago (valor da parcela), NÃO o valor total da conta
        -- Evita duplicidade: projeto via subquery LIMIT 1 (sem JOIN multiplicador)
        SELECT
          tp.data_pagamento::text                                         AS data,
          f.name                                                          AS fornecedor_creditor,
          cp.numero_documento,
          (SELECT p.name
             FROM contas_pagar_projetos cpp
             JOIN projetos p ON p.id = cpp.projeto_id
            WHERE cpp.conta_pagar_id = cp.id
            LIMIT 1)                                                     AS projeto,
          -tp.valor_pago::numeric(15,2)                                  AS valor,
          'CP'                                                            AS tipo,
          m.nome                                                          AS matriz_nome,
          NULLIF(TRIM(COALESCE(tp.observacoes_pagamento, cp.observacoes, '')), '') AS observacoes,
          tp.data_pagamento                                               AS data_ordenacao,
          tp.created_at                                                   AS created_at_ordenacao
        FROM titulos_pagar tp
        INNER JOIN contas_pagar cp ON tp.conta_pagar_id = cp.id
        LEFT  JOIN fornecedores  f  ON cp.fornecedor_id  = f.id
        LEFT  JOIN matrizes      m  ON cp.matriz_id      = m.id
        WHERE tp.conta_id = {{params.contaId}}
          AND tp.status = 'PAGO'
          AND tp.data_pagamento IS NOT NULL
          {{ params.dataInicio ? "AND tp.data_pagamento >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND tp.data_pagamento <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'CP' = '"              + params.tipo        + "'"       : "" }}
          {{ params.matrizId   ? "AND cp.matriz_id = "       + params.matrizId               : "" }}

        UNION ALL

        -- Contas a Receber (Entradas) — um registro por PARCELA efetivamente recebida
        -- Usa tr.valor_recebido (valor da parcela), NÃO o valor total da conta
        -- Evita duplicidade: projeto via subquery LIMIT 1 (sem JOIN multiplicador)
        SELECT
          tr.data_recebimento::text                                       AS data,
          COALESCE(
            CASE
              WHEN cr.entity_type = 'cliente' THEN cl_entity.name
              WHEN cr.entity_type = 'empresa' THEN CONCAT(e.name, ' (Empresa)')
              WHEN cr.entity_type = 'grupo'   THEN CONCAT(g.name, ' (Grupo)')
              ELSE cl_legacy.name
            END,
            cl_legacy.name
          )                                                               AS fornecedor_creditor,
          cr.numero_documento,
          COALESCE(
            (SELECT p.name
               FROM contas_receber_projetos crp
               JOIN projetos p ON p.id = crp.projeto_id
              WHERE crp.conta_receber_id = cr.id
              LIMIT 1),
            (SELECT p.name
               FROM contas_receber_faturamento crf
               JOIN projetos p ON p.id = crf.projeto_id
              WHERE crf.conta_receber_id = cr.id
              LIMIT 1)
          )                                                               AS projeto,
          tr.valor_recebido::numeric(15,2)                               AS valor,
          'CR'                                                            AS tipo,
          m.nome                                                          AS matriz_nome,
          NULLIF(TRIM(COALESCE(tr.observacoes_recebimento, cr.observacoes, '')), '') AS observacoes,
          tr.data_recebimento                                             AS data_ordenacao,
          tr.created_at                                                   AS created_at_ordenacao
        FROM titulos_receber tr
        INNER JOIN contas_receber cr  ON tr.conta_receber_id = cr.id
        LEFT  JOIN clientes cl_legacy ON cr.cliente_id = cl_legacy.id
        LEFT  JOIN clientes cl_entity ON cr.entity_type = 'cliente' AND cr.entity_id = cl_entity.id
        LEFT  JOIN empresas e         ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
        LEFT  JOIN grupos   g         ON cr.entity_type = 'grupo'   AND cr.entity_id = g.id
        LEFT  JOIN matrizes m         ON cr.matriz_id = m.id
        WHERE tr.conta_id = {{params.contaId}}
          AND tr.status = 'RECEBIDO'
          AND tr.data_recebimento IS NOT NULL
          {{ params.dataInicio ? "AND tr.data_recebimento >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND tr.data_recebimento <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'CR' = '"                 + params.tipo       + "'"       : "" }}
          {{ params.matrizId   ? "AND cr.matriz_id = "          + params.matrizId              : "" }}

        UNION ALL

        -- Transferências de Saída
        SELECT
          t.data_transferencia::text              AS data,
          CONCAT('Transf: p/ ', cd.nome)          AS fornecedor_creditor,
          NULL                                    AS numero_documento,
          NULL                                    AS projeto,
          -t.valor::numeric(15,2)                 AS valor,
          'TR'                                    AS tipo,
          NULL                                    AS matriz_nome,
          NULLIF(TRIM(COALESCE(t.observacoes, '')), '') AS observacoes,
          t.data_transferencia                    AS data_ordenacao,
          t.created_at                            AS created_at_ordenacao
        FROM transferencias t
        INNER JOIN contas cd ON t.conta_destino_id = cd.id
        WHERE t.conta_origem_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND t.data_transferencia <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'TR' = '"                  + params.tipo       + "'"       : "" }}

        UNION ALL

        -- Transferências de Entrada
        SELECT
          t.data_transferencia::text              AS data,
          CONCAT('Transf: de ', co.nome)          AS fornecedor_creditor,
          NULL                                    AS numero_documento,
          NULL                                    AS projeto,
          t.valor::numeric(15,2)                  AS valor,
          'TR'                                    AS tipo,
          NULL                                    AS matriz_nome,
          NULLIF(TRIM(COALESCE(t.observacoes, '')), '') AS observacoes,
          t.data_transferencia                    AS data_ordenacao,
          t.created_at                            AS created_at_ordenacao
        FROM transferencias t
        INNER JOIN contas co ON t.conta_origem_id = co.id
        WHERE t.conta_destino_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND t.data_transferencia <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'TR' = '"                  + params.tipo       + "'"       : "" }}

        UNION ALL

        -- Aportes (Entradas)
        SELECT
          a.data_aporte::text                     AS data,
          s.nome                                  AS fornecedor_creditor,
          NULL                                    AS numero_documento,
          NULL                                    AS projeto,
          a.valor::numeric(15,2)                  AS valor,
          'APORTE'                                AS tipo,
          m.nome                                  AS matriz_nome,
          NULLIF(TRIM(COALESCE(a.observacoes, '')), '') AS observacoes,
          a.data_aporte                           AS data_ordenacao,
          a.created_at                            AS created_at_ordenacao
        FROM aportes a
        INNER JOIN socios s  ON a.socio_id  = s.id
        LEFT  JOIN matrizes m ON a.matriz_id = m.id
        WHERE a.conta_id = {{params.contaId}}
          AND a.data_aporte IS NOT NULL
          {{ params.dataInicio ? "AND a.data_aporte >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND a.data_aporte <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'APORTE' = '"       + params.tipo       + "'"       : "" }}
          {{ params.matrizId   ? "AND a.matriz_id = "     + params.matrizId              : "" }}

        UNION ALL

        -- Retiradas (Saídas)
        SELECT
          r.data_retirada::text                   AS data,
          s.nome                                  AS fornecedor_creditor,
          NULL                                    AS numero_documento,
          NULL                                    AS projeto,
          -r.valor::numeric(15,2)                 AS valor,
          'RETIRADA'                              AS tipo,
          m.nome                                  AS matriz_nome,
          NULLIF(TRIM(COALESCE(r.observacoes, '')), '') AS observacoes,
          r.data_retirada                         AS data_ordenacao,
          r.created_at                            AS created_at_ordenacao
        FROM retiradas r
        INNER JOIN socios s  ON r.socio_id  = s.id
        LEFT  JOIN matrizes m ON r.matriz_id = m.id
        WHERE r.conta_id = {{params.contaId}}
          AND r.data_retirada IS NOT NULL
          {{ params.dataInicio ? "AND r.data_retirada >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND r.data_retirada <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'RETIRADA' = '"       + params.tipo       + "'"       : "" }}
          {{ params.matrizId   ? "AND r.matriz_id = "       + params.matrizId              : "" }}

        UNION ALL

        -- Empréstimos (Saídas) — dinheiro emprestado sai da conta
        SELECT
          e.data_emprestimo::text                 AS data,
          s.nome                                  AS fornecedor_creditor,
          NULL                                    AS numero_documento,
          NULL                                    AS projeto,
          -e.valor::numeric(15,2)                 AS valor,
          'EMP'                                   AS tipo,
          m.nome                                  AS matriz_nome,
          NULLIF(TRIM(COALESCE(e.observacoes, '')), '') AS observacoes,
          e.data_emprestimo                       AS data_ordenacao,
          e.created_at                            AS created_at_ordenacao
        FROM emprestimos e
        INNER JOIN socios s   ON e.socio_id  = s.id
        LEFT  JOIN matrizes m ON e.matriz_id = m.id
        WHERE e.conta_id = {{params.contaId}}
          AND e.tipo = 'EMPRESTIMO'
          AND e.data_emprestimo IS NOT NULL
          {{ params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND e.data_emprestimo <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'EMP' = '"              + params.tipo       + "'"       : "" }}
          {{ params.matrizId   ? "AND e.matriz_id = "         + params.matrizId              : "" }}

        UNION ALL

        -- Pagamentos de Empréstimo (Entradas) — dinheiro devolvido entra na conta
        SELECT
          e.data_emprestimo::text                 AS data,
          s.nome                                  AS fornecedor_creditor,
          NULL                                    AS numero_documento,
          NULL                                    AS projeto,
          e.valor::numeric(15,2)                  AS valor,
          'PGEMP'                                 AS tipo,
          m.nome                                  AS matriz_nome,
          NULLIF(TRIM(COALESCE(e.observacoes, '')), '') AS observacoes,
          e.data_emprestimo                       AS data_ordenacao,
          e.created_at                            AS created_at_ordenacao
        FROM emprestimos e
        INNER JOIN socios s   ON e.socio_id  = s.id
        LEFT  JOIN matrizes m ON e.matriz_id = m.id
        WHERE e.conta_id = {{params.contaId}}
          AND e.tipo = 'PAGAMENTO'
          AND e.data_emprestimo IS NOT NULL
          {{ params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND e.data_emprestimo <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.tipo       ? "AND 'PGEMP' = '"            + params.tipo       + "'"       : "" }}
          {{ params.matrizId   ? "AND e.matriz_id = "         + params.matrizId              : "" }}
      )
      SELECT * FROM movimentacoes
      ORDER BY data_ordenacao ASC, created_at_ordenacao ASC;
    `,
  });
}

export default loadExtrato;
