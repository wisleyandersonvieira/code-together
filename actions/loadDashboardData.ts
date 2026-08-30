import { action } from '@uibakery/data';

/**
 * Consolidated query that loads ALL dashboard data in a single call:
 * - Dashboard stats (counts, totals)
 * - Métricas do mês corrente (entradas novas)
 * - Série de VGV dos últimos 12 meses
 * - Kanban column stats (com o ícone da coluna)
 * - Contas em destaque (saldo + data da última movimentação)
 * - Parametros do sistema
 *
 * Uma chamada só, de propósito: todo dado novo entra como sub-select deste
 * mesmo SELECT, nunca como round-trip novo.
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
        'metricas', (
          SELECT row_to_json(x) FROM (
            SELECT
              (SELECT COUNT(*) FROM projetos
                WHERE status = 'Em andamento'
                  AND created_at >= date_trunc('month', CURRENT_DATE)) AS projetos_novos_mes,
              (SELECT COUNT(*) FROM clientes
                WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS clientes_novos_mes
          ) x
        ),
        'vgv_serie', (
          -- VGV acumulado dos projetos em andamento por mês de CADASTRO, últimos 12 meses.
          -- Não é a evolução histórica do VGV (não existe snapshot); é a curva de entrada
          -- de projetos. O rótulo do card diz isso — não mude para "evolução do VGV".
          SELECT COALESCE(json_agg(row_to_json(s) ORDER BY s.mes), '[]'::json) FROM (
            SELECT m.mes,
                   (SELECT COALESCE(SUM(p.predicted_sale_value), 0)
                      FROM projetos p
                     WHERE p.status = 'Em andamento'
                       AND date_trunc('month', p.created_at) <= m.mes) AS vgv
            FROM generate_series(
              date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
              date_trunc('month', CURRENT_DATE), INTERVAL '1 month'
            ) AS m(mes)
          ) s
        ),
        'kanban', (
          SELECT COALESCE(json_agg(row_to_json(k) ORDER BY k.position), '[]'::json)
          FROM (
            SELECT 
              kc.id, kc.name, kc.position, kc.color, kc.icon,
              COUNT(p.id) as projeto_count
            FROM kanban_columns kc
            LEFT JOIN projetos p ON kc.id = p.kanban_column_id
            GROUP BY kc.id, kc.name, kc.position, kc.color, kc.icon
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
                COALESCE(SUM(movimentos.valor), 0) as total_movimentos,
                -- Mesma subquery do saldo, então o MAX enxerga exatamente os
                -- mesmos lançamentos que somaram: data que não entrou no saldo
                -- não pode aparecer como última movimentação.
                -- Conta sem movimento devolve NULL (o LEFT JOIN não produz linha),
                -- e NULL é o que a interface traduz por "Sem movimentação".
                -- Não caia para data_saldo_inicial: aquela é a data do saldo
                -- base, não de uma movimentação.
                MAX(movimentos.data) as ultima_movimentacao
              FROM contas c
              LEFT JOIN (
                SELECT tp.conta_id, -ABS(tp.valor_pago) as valor, tp.data_pagamento as data
                FROM titulos_pagar tp
                WHERE tp.status = 'PAGO' AND tp.data_pagamento IS NOT NULL AND tp.data_pagamento <= CURRENT_DATE
                UNION ALL
                SELECT tr.conta_id, ABS(tr.valor_recebido) as valor, tr.data_recebimento as data
                FROM titulos_receber tr
                WHERE tr.status = 'RECEBIDO' AND tr.data_recebimento IS NOT NULL AND tr.data_recebimento <= CURRENT_DATE
                UNION ALL
                SELECT t.conta_origem_id, -ABS(t.valor) as valor, t.data_transferencia as data
                FROM transferencias t
                WHERE t.data_transferencia IS NOT NULL AND t.data_transferencia <= CURRENT_DATE
                UNION ALL
                SELECT t.conta_destino_id, ABS(t.valor) as valor, t.data_transferencia as data
                FROM transferencias t
                WHERE t.data_transferencia IS NOT NULL AND t.data_transferencia <= CURRENT_DATE
                UNION ALL
                SELECT a.conta_id, ABS(a.valor) as valor, a.data_aporte as data
                FROM aportes a
                WHERE a.data_aporte IS NOT NULL AND a.data_aporte <= CURRENT_DATE
                UNION ALL
                SELECT r.conta_id, -ABS(r.valor) as valor, r.data_retirada as data
                FROM retiradas r
                WHERE r.data_retirada IS NOT NULL AND r.data_retirada <= CURRENT_DATE
                UNION ALL
                SELECT e.conta_id, -ABS(e.valor) as valor, e.data_emprestimo as data
                FROM emprestimos e
                WHERE e.tipo = 'EMPRESTIMO' AND e.data_emprestimo IS NOT NULL AND e.data_emprestimo <= CURRENT_DATE
                UNION ALL
                SELECT e.conta_id, ABS(e.valor) as valor, e.data_emprestimo as data
                FROM emprestimos e
                WHERE e.tipo = 'PAGAMENTO' AND e.data_emprestimo IS NOT NULL AND e.data_emprestimo <= CURRENT_DATE
              ) movimentos ON c.id = movimentos.conta_id
              WHERE c.destaque = TRUE
              GROUP BY c.id, c.nome, c.banco, c.numero, c.saldo_inicial, c.data_saldo_inicial
            )
            SELECT 
              conta_id as id, nome, banco, numero, saldo_inicial, data_saldo_inicial,
              ultima_movimentacao,
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
