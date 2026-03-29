import { action } from '@uibakery/data';

function loadRelatorioProjetosGeral() {
  return action('loadRelatorioProjetosGeral', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH despesas_projeto AS (
        SELECT 
          p.id as projeto_id,
          p.name as projeto_nome,
          COALESCE(SUM(
            CASE 
              WHEN tp.status = 'PAGO' AND tp.valor_pago IS NOT NULL 
                THEN ROUND(tp.valor_pago * COALESCE(cpp.percentual, 100) / 100.0, 2)
              ELSE 0 
            END
          ), 0) as total_despesas
        FROM projetos p
        LEFT JOIN contas_pagar_projetos cpp ON p.id = cpp.projeto_id
        LEFT JOIN contas_pagar cp ON cpp.conta_pagar_id = cp.id
        LEFT JOIN titulos_pagar tp ON cp.id = tp.conta_pagar_id
        WHERE 1 = 1
          {{ params.projetoIds && params.projetoIds.length > 0 ? "AND p.id IN (" + params.projetoIds.join(",") + ")" : "" }}
          {{ params.matrizId ? "AND cp.matriz_id = " + params.matrizId : "" }}
          {{ params.dataPagamentoInicio ? "AND tp.data_pagamento >= '" + params.dataPagamentoInicio + "'" : "" }}
          {{ params.dataPagamentoFim ? "AND tp.data_pagamento <= '" + params.dataPagamentoFim + "'" : "" }}
        GROUP BY p.id, p.name
      ),
      receitas_rateio AS (
        SELECT 
          p.id as projeto_id,
          p.name as projeto_nome,
          COALESCE(SUM(
            CASE 
              WHEN tr.status = 'RECEBIDO' AND tr.valor_recebido IS NOT NULL 
                THEN ROUND(tr.valor_recebido * COALESCE(crp.percentual, 100) / 100.0, 2)
              ELSE 0 
            END
          ), 0) as total_receitas
        FROM projetos p
        LEFT JOIN contas_receber_projetos crp ON p.id = crp.projeto_id
        LEFT JOIN contas_receber cr ON crp.conta_receber_id = cr.id
        LEFT JOIN titulos_receber tr ON cr.id = tr.conta_receber_id
        WHERE 1 = 1
          {{ params.projetoIds && params.projetoIds.length > 0 ? "AND p.id IN (" + params.projetoIds.join(",") + ")" : "" }}
          {{ params.matrizId ? "AND cr.matriz_id = " + params.matrizId : "" }}
          {{ params.dataPagamentoInicio ? "AND tr.data_recebimento >= '" + params.dataPagamentoInicio + "'" : "" }}
          {{ params.dataPagamentoFim ? "AND tr.data_recebimento <= '" + params.dataPagamentoFim + "'" : "" }}
        GROUP BY p.id, p.name
      ),
      receitas_faturamento AS (
        SELECT 
          p.id as projeto_id,
          p.name as projeto_nome,
          COALESCE(SUM(
            CASE 
              -- Verifica se há títulos recebidos relacionados à conta a receber
              WHEN EXISTS (
                SELECT 1 
                FROM titulos_receber tr 
                JOIN contas_receber cr_inner ON tr.conta_receber_id = cr_inner.id
                WHERE tr.conta_receber_id = crf.conta_receber_id 
                  AND tr.status = 'RECEBIDO'
                  {{ params.matrizId ? "AND cr_inner.matriz_id = " + params.matrizId : "" }}
                  {{ params.dataPagamentoInicio ? "AND tr.data_recebimento >= '" + params.dataPagamentoInicio + "'" : "" }}
                  {{ params.dataPagamentoFim ? "AND tr.data_recebimento <= '" + params.dataPagamentoFim + "'" : "" }}
              )
              THEN crf.valor_faturamento 
              ELSE 0 
            END
          ), 0) as total_faturamento
        FROM projetos p
        LEFT JOIN contas_receber_faturamento crf ON p.id = crf.projeto_id
        WHERE 1 = 1
          {{ params.projetoIds && params.projetoIds.length > 0 ? "AND p.id IN (" + params.projetoIds.join(",") + ")" : "" }}
        GROUP BY p.id, p.name
      ),
      todos_projetos AS (
        SELECT DISTINCT projeto_id, projeto_nome
        FROM (
          SELECT projeto_id, projeto_nome FROM despesas_projeto
          UNION
          SELECT projeto_id, projeto_nome FROM receitas_rateio
          UNION
          SELECT projeto_id, projeto_nome FROM receitas_faturamento
        ) all_projetos
      )
      SELECT 
        tp.projeto_id,
        tp.projeto_nome,
        COALESCE(dp.total_despesas, 0) as valor_despesas,
        (COALESCE(rr.total_receitas, 0) + COALESCE(rf.total_faturamento, 0)) as valor_receitas,
        ((COALESCE(rr.total_receitas, 0) + COALESCE(rf.total_faturamento, 0)) - COALESCE(dp.total_despesas, 0)) as saldo
      FROM todos_projetos tp
      LEFT JOIN despesas_projeto dp ON tp.projeto_id = dp.projeto_id
      LEFT JOIN receitas_rateio rr ON tp.projeto_id = rr.projeto_id
      LEFT JOIN receitas_faturamento rf ON tp.projeto_id = rf.projeto_id
      WHERE (COALESCE(dp.total_despesas, 0) > 0 
             OR COALESCE(rr.total_receitas, 0) > 0
             OR COALESCE(rf.total_faturamento, 0) > 0)
      ORDER BY tp.projeto_nome;
    `,
  });
}

export default loadRelatorioProjetosGeral;
