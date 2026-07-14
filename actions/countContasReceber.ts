import { action } from '@uibakery/data';

function countContasReceber() {
  return action('countContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT COUNT(*) as total
      FROM contas_receber cr
      {{ params && params.searchCliente ? "LEFT JOIN clientes c ON cr.cliente_id = c.id LEFT JOIN clientes cl ON cr.entity_type = 'cliente' AND cr.entity_id = cl.id LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id" : "" }}
      {{ params && params.searchMatriz ? "LEFT JOIN matrizes m ON cr.matriz_id = m.id" : "" }}
      {{ params && (params.searchStatus === 'RECEBIDO_TOTAL' || params.searchStatus === 'RECEBIDO_PARCIAL') ? "LEFT JOIN LATERAL (SELECT COUNT(*) AS qtd_total, COUNT(*) FILTER (WHERE tr.status = 'RECEBIDO') AS qtd_recebidos FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id) st ON TRUE" : "" }}
      WHERE {{ params && params.skipCount ? "FALSE" : "1 = 1" }}
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
        {{ params && params.dataRecebimentoFim ? "AND EXISTS (SELECT 1 FROM titulos_receber tr WHERE tr.conta_receber_id = cr.id AND tr.status = 'RECEBIDO' AND tr.data_recebimento <= '" + params.dataRecebimentoFim + "')" : "" }};
    `,
  });
}

export default countContasReceber;
