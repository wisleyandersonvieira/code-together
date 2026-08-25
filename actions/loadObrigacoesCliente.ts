import { action } from '@uibakery/data';

/** Vínculos cliente ↔ obrigação, com o retrato das competências em aberto. */
function loadObrigacoesCliente() {
  return action('loadObrigacoesCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        oc.id,
        oc.entity_type,
        oc.entity_id,
        ent.entity_name,
        oc.obrigacao_id,
        o.nome AS obrigacao_nome,
        o.periodicidade,
        o.setor,
        o.dia_vencimento,
        o.mes_offset,
        oc.responsavel_user_id,
        u.name AS responsavel_nome,
        oc.data_inicio,
        oc.data_fim,
        oc.ativo,
        oc.observacoes,
        COALESCE(agg.abertas, 0) AS competencias_abertas,
        COALESCE(agg.atrasadas, 0) AS competencias_atrasadas,
        agg.proximo_vencimento
      FROM obrigacoes_cliente oc
      JOIN obrigacoes_catalogo o ON o.id = oc.obrigacao_id
      LEFT JOIN users u ON u.id = oc.responsavel_user_id
      LEFT JOIN vw_operacao_entidades ent
        ON ent.entity_type = oc.entity_type AND ent.entity_id = oc.entity_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS abertas,
          COUNT(*) FILTER (WHERE k.data_vencimento < CURRENT_DATE) AS atrasadas,
          MIN(k.data_vencimento) FILTER (WHERE k.data_vencimento >= CURRENT_DATE) AS proximo_vencimento
        FROM obrigacoes_competencias k
        WHERE k.obrigacao_cliente_id = oc.id
          AND k.status NOT IN ('ENTREGUE', 'DISPENSADA')
      ) agg ON TRUE
      WHERE 1 = 1
        {{ params && params.entityType && params.entityType !== 'all' ? "AND oc.entity_type = '" + params.entityType + "'" : "" }}
        {{ params && params.entityId ? "AND oc.entity_id = " + Number(params.entityId) : "" }}
        {{ params && params.obrigacaoId && params.obrigacaoId !== 'all' ? "AND oc.obrigacao_id = " + Number(params.obrigacaoId) : "" }}
        {{ params && params.responsavelId && params.responsavelId !== 'all' ? "AND oc.responsavel_user_id = " + Number(params.responsavelId) : "" }}
        {{ params && params.apenasAtivos ? "AND oc.ativo = true" : "" }}
        {{ params && params.searchTerm ? "AND (ent.entity_name ILIKE '%" + params.searchTerm + "%' OR o.nome ILIKE '%" + params.searchTerm + "%')" : "" }}
      ORDER BY COALESCE(agg.atrasadas, 0) DESC, ent.entity_name, o.nome;
    `,
  });
}

export default loadObrigacoesCliente;
