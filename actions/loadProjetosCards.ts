import { action } from '@uibakery/data';

// Data source for the Projetos "cards" view. Everything a card needs in ONE query,
// aggregated per project (no N+1, no per-row correlated subqueries), and WITHOUT
// pulling the photo binaries (files.file_data) — the cover image is fetched lazily
// per card via getFile(cover_file_id).
//
// Percentages replicate exactly what components/ProjetoEvolucao.tsx computes:
//   - "Realizado (Orçamento)" = SUM(valor_realizado) / SUM(valor_orcado), where
//     per-orçamento valor_realizado = SUM(conta_pagar_orcamento_alocacao.valor_alocado)
//     (see actions/loadProjetoEvolucaoOrcamento.ts).
//   - "Recebido (Aportes)" = SUM(valor_realizado) / SUM(valor_previsto), where
//     per-aporte valor_realizado = SUM(rateio_aportes.valor_rateado)
//     (see actions/loadProjetoEvolucaoAportes.ts).
function loadProjetosCards() {
  return action('loadProjetosCards', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH orc AS (
        SELECT
          o.projeto_id,
          SUM(o.value) AS total_orcado,
          COALESCE(SUM(a.valor_realizado), 0) AS total_realizado_orc
        FROM orcamentos o
        LEFT JOIN (
          SELECT orcamento_id, SUM(valor_alocado) AS valor_realizado
          FROM conta_pagar_orcamento_alocacao
          GROUP BY orcamento_id
        ) a ON a.orcamento_id = o.id
        GROUP BY o.projeto_id
      ),
      apo AS (
        SELECT
          pa.projeto_id,
          SUM(pa.valor_previsto) AS total_previsto_aporte,
          COALESCE(SUM(r.valor_realizado), 0) AS total_realizado_aporte
        FROM previsao_aportes pa
        LEFT JOIN (
          SELECT aporte_id, SUM(valor_rateado) AS valor_realizado
          FROM rateio_aportes
          GROUP BY aporte_id
        ) r ON r.aporte_id = pa.id
        GROUP BY pa.projeto_id
      ),
      covers AS (
        SELECT entity_id AS projeto_id, MAX(id) FILTER (WHERE is_cover) AS cover_file_id
        FROM files
        WHERE entity_type = 'projeto_photo'
        GROUP BY entity_id
      )
      SELECT
        p.id,
        p.name,
        p.city,
        p.status,
        p.predicted_sale_value,
        cov.cover_file_id,
        COALESCE(orc.total_orcado, 0) AS total_orcado,
        COALESCE(orc.total_realizado_orc, 0) AS total_realizado_orc,
        COALESCE(apo.total_previsto_aporte, 0) AS total_previsto_aporte,
        COALESCE(apo.total_realizado_aporte, 0) AS total_realizado_aporte,
        CASE
          WHEN COALESCE(orc.total_orcado, 0) > 0
          THEN ROUND((orc.total_realizado_orc / orc.total_orcado) * 100, 1)
          ELSE 0
        END AS pct_orcamento_realizado,
        CASE
          WHEN COALESCE(apo.total_previsto_aporte, 0) > 0
          THEN ROUND((apo.total_realizado_aporte / apo.total_previsto_aporte) * 100, 1)
          ELSE 0
        END AS pct_aportes_realizado,
        COALESCE(
          (SELECT JSON_AGG(sub.mem ORDER BY sub.id) FROM (
            SELECT DISTINCT ON (pm.id) JSON_BUILD_OBJECT(
              'cliente_id', pm.cliente_id,
              'empresa_id', pm.empresa_id,
              'grupo_id', pm.grupo_id,
              'cliente_name', c.name,
              'empresa_name', e.name,
              'grupo_name', g.name,
              'percentage', pm.percentage
            ) as mem, pm.id
            FROM projeto_members pm
            LEFT JOIN clientes c ON pm.cliente_id = c.id
            LEFT JOIN empresas e ON pm.empresa_id = e.id
            LEFT JOIN grupos g ON pm.grupo_id = g.id
            WHERE pm.projeto_id = p.id
            ORDER BY pm.id
          ) sub),
          '[]'::json
        ) AS members
      FROM projetos p
      LEFT JOIN orc ON orc.projeto_id = p.id
      LEFT JOIN apo ON apo.projeto_id = p.id
      LEFT JOIN covers cov ON cov.projeto_id = p.id
      WHERE 1 = 1
        {{ params && params.status === 'Em andamento' ? "AND (p.status = 'Em andamento' OR p.status IS NULL)" : "" }}
        {{ params && params.status === 'Concluído' ? "AND p.status = 'Concluído'" : "" }}
      ORDER BY p.name ASC;
    `,
  });
}

export default loadProjetosCards;
