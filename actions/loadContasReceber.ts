import { action } from '@uibakery/data';

function loadContasReceber() {
  return action('loadContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT DISTINCT
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
        (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id) as total_titulos,
        (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') as titulos_recebidos,
        (SELECT MIN(tr.data_recebimento) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') as data_primeiro_recebimento,
        (SELECT MAX(tr.data_recebimento) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') as data_ultimo_recebimento,
        STRING_AGG(DISTINCT p.name, ', ') as projetos_nomes
      FROM contas_receber cr
      LEFT JOIN clientes c ON cr.cliente_id = c.id
      LEFT JOIN clientes cl ON cr.entity_type = 'cliente' AND cr.entity_id = cl.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
      JOIN tipos_documento td ON cr.tipo_documento_id = td.id
      LEFT JOIN matrizes m ON cr.matriz_id = m.id
      LEFT JOIN contas_receber_projetos crp ON cr.id = crp.conta_receber_id
      LEFT JOIN projetos p ON crp.projeto_id = p.id
      WHERE 1 = 1
        {{ params && params.searchCliente ? "AND COALESCE(CASE WHEN cr.entity_type = 'cliente' THEN cl.name WHEN cr.entity_type = 'empresa' THEN e.name WHEN cr.entity_type = 'grupo' THEN g.name ELSE c.name END, c.name) ILIKE '%" + params.searchCliente + "%'" : "" }}
        {{ params && params.searchStatus === 'PENDENTE' ? "AND (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') = 0" : "" }}
        {{ params && params.searchStatus === 'RECEBIDO_TOTAL' ? "AND (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') = (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id) AND (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id) > 0" : "" }}
        {{ params && params.searchStatus === 'RECEBIDO_PARCIAL' ? "AND (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') > 0 AND (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO') < (SELECT COUNT(*) FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id)" : "" }}
        {{ params && params.searchNumeroDocumento ? "AND cr.numero_documento ILIKE '%" + params.searchNumeroDocumento + "%'" : "" }}
        {{ params && params.searchProjeto ? "AND p.name ILIKE '%" + params.searchProjeto + "%'" : "" }}
        {{ params && params.searchMatriz ? "AND m.nome ILIKE '%" + params.searchMatriz + "%'" : "" }}
        {{ params && params.dataVencimentoInicio ? "AND cr.data_vencimento >= '" + params.dataVencimentoInicio + "'" : "" }}
        {{ params && params.dataVencimentoFim ? "AND cr.data_vencimento <= '" + params.dataVencimentoFim + "'" : "" }}
        {{ params && params.dataRecebimentoInicio ? "AND EXISTS (SELECT 1 FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO' AND tr.data_recebimento >= '" + params.dataRecebimentoInicio + "')" : "" }}
        {{ params && params.dataRecebimentoFim ? "AND EXISTS (SELECT 1 FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO' AND tr.data_recebimento <= '" + params.dataRecebimentoFim + "')" : "" }}
      GROUP BY cr.id, c.name, cl.name, e.name, g.name, cr.entity_type, td.descricao, m.nome
      ORDER BY cr.data_vencimento DESC, cr.id DESC
      {{ params && params.hasFilters && params.limit ? "LIMIT " + params.limit : "" }}
      {{ params && params.hasFilters && params.page && params.limit ? "OFFSET " + ((params.page - 1) * params.limit) : "" }}
      {{ !params || !params.hasFilters ? "LIMIT 5" : "" }};
    `,
  });
}

export default loadContasReceber;
