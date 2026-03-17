import { action } from '@uibakery/data';

/**
 * Consolidated query that loads ALL dashboard data in a single call:
 * - Dashboard stats (counts, totals)
 * - Kanban column stats
 * - Contas em destaque (with saldo calculations)
 * - Parametros do sistema
 */
function loadDashboardData() {
  return action('loadDashboardData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT json_build_object(
        'stats', (
          SELECT row_to_json(s) FROM (
            SELECT 
              (SELECT COUNT(*) FROM users) as total_users,
              (SELECT COUNT(*) FROM clientes) as total_clientes,
              (SELECT COUNT(*) FROM empresas) as total_empresas,
              (SELECT COUNT(*) FROM grupos) as total_grupos,
              (SELECT COUNT(*) FROM fornecedores) as total_fornecedores,
              (SELECT COUNT(*) FROM projetos WHERE status = 'Em andamento') as projetos_em_andamento,
              (SELECT COUNT(*) FROM projetos WHERE status = 'Concluído') as projetos_concluidos,
              (SELECT COALESCE(SUM(predicted_sale_value), 0) FROM projetos WHERE predicted_sale_value IS NOT NULL AND status = 'Em andamento') as vgv_previsto,
              (SELECT COALESCE(SUM(value), 0) FROM orcamentos) as total_orcamentos_value
          ) s
        ),
        'kanban', (
          SELECT COALESCE(json_agg(row_to_json(k) ORDER BY k.position), '[]'::json)
          FROM (
            SELECT 
              kc.id, kc.name, kc.position, kc.color,
              COUNT(p.id) as projeto_count
            FROM kanban_columns kc
            LEFT JOIN projetos p ON kc.id = p.kanban_column_id
            GROUP BY kc.id, kc.name, kc.position, kc.color
            ORDER BY kc.position
          ) k
        ),
        'contas_destaque', (
          SELECT COALESCE(json_agg(row_to_json(cd) ORDER BY cd.nome), '[]'::json)
          FROM (
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
                SELECT tp.conta_id, -ABS(tp.valor_pago) as valor
                FROM titulos_pagar tp
                WHERE tp.status = 'PAGO' AND tp.data_pagamento IS NOT NULL AND tp.data_pagamento <= CURRENT_DATE
                UNION ALL
                SELECT tr.conta_id, ABS(tr.valor_recebido) as valor
                FROM titulos_receber tr
                WHERE tr.status = 'RECEBIDO' AND tr.data_recebimento IS NOT NULL AND tr.data_recebimento <= CURRENT_DATE
                UNION ALL
                SELECT t.conta_origem_id, -ABS(t.valor) as valor
                FROM transferencias t
                WHERE t.data_transferencia IS NOT NULL AND t.data_transferencia <= CURRENT_DATE
                UNION ALL
                SELECT t.conta_destino_id, ABS(t.valor) as valor
                FROM transferencias t
                WHERE t.data_transferencia IS NOT NULL AND t.data_transferencia <= CURRENT_DATE
                UNION ALL
                SELECT a.conta_id, ABS(a.valor) as valor
                FROM aportes a
                WHERE a.data_aporte IS NOT NULL AND a.data_aporte <= CURRENT_DATE
                UNION ALL
                SELECT r.conta_id, -ABS(r.valor) as valor
                FROM retiradas r
                WHERE r.data_retirada IS NOT NULL AND r.data_retirada <= CURRENT_DATE
              ) movimentos ON c.id = movimentos.conta_id
              WHERE c.destaque = TRUE
              GROUP BY c.id, c.nome, c.banco, c.numero, c.saldo_inicial, c.data_saldo_inicial
            )
            SELECT 
              conta_id as id, nome, banco, numero, saldo_inicial, data_saldo_inicial,
              (saldo_inicial + total_movimentos) as saldo_atual
            FROM movimentacoes_por_conta
            ORDER BY nome
          ) cd
        ),
        'parametros', (
          SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.chave), '[]'::json)
          FROM (SELECT * FROM parametros ORDER BY chave) p
        )
      ) as data;
    `,
  });
}

export default loadDashboardData;
