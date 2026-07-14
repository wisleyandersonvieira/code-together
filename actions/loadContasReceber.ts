import { action } from '@uibakery/data';

function loadContasReceber() {
  return action('loadContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH base AS (
        SELECT cr.id
        FROM contas_receber cr
        JOIN tipos_documento td ON cr.tipo_documento_id = td.id
        {{ params && params.searchCliente ? "LEFT JOIN clientes c ON cr.cliente_id = c.id LEFT JOIN clientes cl ON cr.entity_type = 'cliente' AND cr.entity_id = cl.id LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id" : "" }}
        {{ params && params.searchMatriz ? "LEFT JOIN matrizes m ON cr.matriz_id = m.id" : "" }}
        {{ params && (params.searchStatus === 'RECEBIDO_TOTAL' || params.searchStatus === 'RECEBIDO_PARCIAL') ? "LEFT JOIN LATERAL (SELECT COUNT(*) AS qtd_total, COUNT(*) FILTER (WHERE tr.status = 'RECEBIDO') AS qtd_recebidos FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id) st ON TRUE" : "" }}
        WHERE 1 = 1
          {{ params && params.searchCliente ? "AND COALESCE(CASE WHEN cr.entity_type = 'cliente' THEN cl.name WHEN cr.entity_type = 'empresa' THEN e.name WHEN cr.entity_type = 'grupo' THEN g.name ELSE c.name END, c.name) ILIKE '%" + params.searchCliente + "%'" : "" }}
          {{ params && params.searchStatus === 'PENDENTE' ? "AND NOT EXISTS (SELECT 1 FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO')" : "" }}
          {{ params && params.searchStatus === 'RECEBIDO_TOTAL' ? "AND st.qtd_total > 0 AND st.qtd_recebidos = st.qtd_total" : "" }}
          {{ params && params.searchStatus === 'RECEBIDO_PARCIAL' ? "AND st.qtd_recebidos > 0 AND st.qtd_recebidos < st.qtd_total" : "" }}
          {{ params && params.searchNumeroDocumento ? "AND cr.numero_documento ILIKE '%" + params.searchNumeroDocumento + "%'" : "" }}
          {{ params && params.searchProjeto ? "AND EXISTS (SELECT 1 FROM contas_receber_projetos crp JOIN projetos p ON p.id = crp.projeto_id WHERE crp.conta_receber_id = cr.id AND p.name ILIKE '%" + params.searchProjeto + "%')" : "" }}
          {{ params && params.searchMatriz ? "AND m.nome ILIKE '%" + params.searchMatriz + "%'" : "" }}
          {{ params && params.dataVencimentoInicio ? "AND cr.data_vencimento >= '" + params.dataVencimentoInicio + "'" : "" }}
          {{ params && params.dataVencimentoFim ? "AND cr.data_vencimento <= '" + params.dataVencimentoFim + "'" : "" }}
          {{ params && params.dataRecebimentoInicio ? "AND EXISTS (SELECT 1 FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO' AND tr.data_recebimento >= '" + params.dataRecebimentoInicio + "')" : "" }}
          {{ params && params.dataRecebimentoFim ? "AND EXISTS (SELECT 1 FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO' AND tr.data_recebimento <= '" + params.dataRecebimentoFim + "')" : "" }}
        ORDER BY cr.data_vencimento DESC, cr.id DESC
        {{ params && params.hasFilters && params.limit ? "LIMIT " + params.limit : "" }}
        {{ params && params.hasFilters && params.page && params.limit ? "OFFSET " + ((params.page - 1) * params.limit) : "" }}
        {{ !params || !params.hasFilters ? "LIMIT 5" : "" }}
      ),
      titulos_agg AS (
        SELECT
          tr.conta_receber_id,
          COUNT(*) AS total_titulos,
          COUNT(*) FILTER (WHERE tr.status = 'RECEBIDO') AS titulos_recebidos,
          MIN(tr.data_recebimento) FILTER (WHERE tr.status = 'RECEBIDO') AS data_primeiro_recebimento,
          MAX(tr.data_recebimento) FILTER (WHERE tr.status = 'RECEBIDO') AS data_ultimo_recebimento
        FROM titulos_receber tr
        WHERE tr.conta_receber_id IN (SELECT id FROM base)
        GROUP BY tr.conta_receber_id
      ),
      projetos_agg AS (
        SELECT
          crp.conta_receber_id,
          STRING_AGG(DISTINCT p.name, ', ') AS projetos_nomes
        FROM contas_receber_projetos crp
        JOIN projetos p ON p.id = crp.projeto_id
        WHERE crp.conta_receber_id IN (SELECT id FROM base)
        GROUP BY crp.conta_receber_id
      )
      SELECT
        cr.*,
        COALESCE(
          CASE
            WHEN cr.entity_type = 'cliente' THEN cl.name
            WHEN cr.entity_type = 'empresa' THEN CONCAT(e.name, ' (Empresa)')
            WHEN cr.entity_type = 'grupo' THEN CONCAT(g.name, ' (Grupo)')
            ELSE c.name
          END,
          c.name
        ) as cliente_nome,
        cr.entity_type,
        td.descricao as tipo_documento_descricao,
        m.nome as matriz_nome,
        COALESCE(ta.total_titulos, 0) as total_titulos,
        COALESCE(ta.titulos_recebidos, 0) as titulos_recebidos,
        ta.data_primeiro_recebimento,
        ta.data_ultimo_recebimento,
        pa.projetos_nomes
      FROM base b
      JOIN contas_receber cr ON cr.id = b.id
      JOIN tipos_documento td ON cr.tipo_documento_id = td.id
      LEFT JOIN clientes c ON cr.cliente_id = c.id
      LEFT JOIN clientes cl ON cr.entity_type = 'cliente' AND cr.entity_id = cl.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
      LEFT JOIN matrizes m ON cr.matriz_id = m.id
      LEFT JOIN titulos_agg ta ON ta.conta_receber_id = cr.id
      LEFT JOIN projetos_agg pa ON pa.conta_receber_id = cr.id
      ORDER BY cr.data_vencimento DESC, cr.id DESC;
    `,
  });
}

export default loadContasReceber;
