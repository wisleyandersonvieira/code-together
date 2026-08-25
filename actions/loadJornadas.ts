import { action } from '@uibakery/data';

/**
 * Lista de jornadas com a leitura operacional pronta: quantas etapas estão
 * atrasadas, quantas estão travadas em terceiros e qual o pior atraso.
 */
function loadJornadas() {
  return action('loadJornadas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        j.id,
        j.entity_type,
        j.entity_id,
        ent.entity_name,
        j.fluxo_id,
        f.nome AS fluxo_nome,
        j.status,
        j.data_inicio,
        j.data_conclusao,
        j.observacoes,
        j.responsavel_user_id,
        u.name AS responsavel_nome,
        j.etapa_atual_item_id,
        fe.nome AS etapa_atual_nome,
        atual.status AS etapa_atual_status,
        atual.data_limite AS etapa_atual_limite,
        j.total_etapas,
        j.etapas_concluidas,
        j.progresso,
        COALESCE(agg.atrasadas, 0) AS etapas_atrasadas,
        COALESCE(agg.aguardando, 0) AS etapas_aguardando,
        agg.pior_atraso,
        j.created_at,
        j.updated_at
      FROM jornadas j
      LEFT JOIN users u ON u.id = j.responsavel_user_id
      LEFT JOIN jornada_fluxos f ON f.id = j.fluxo_id
      LEFT JOIN jornada_etapa_itens atual ON atual.id = j.etapa_atual_item_id
      LEFT JOIN jornada_fluxo_etapas fe ON fe.id = atual.fluxo_etapa_id
      LEFT JOIN vw_operacao_entidades ent
        ON ent.entity_type = j.entity_type AND ent.entity_id = j.entity_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE i.data_limite IS NOT NULL
              AND i.data_limite < CURRENT_DATE
              AND i.status NOT IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')
          ) AS atrasadas,
          COUNT(*) FILTER (WHERE i.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')) AS aguardando,
          MAX(CURRENT_DATE - i.data_limite) FILTER (WHERE i.data_limite < CURRENT_DATE) AS pior_atraso
        FROM jornada_etapa_itens i
        WHERE i.jornada_id = j.id
          AND i.status NOT IN ('CONCLUIDA', 'NAO_APLICAVEL')
      ) agg ON TRUE
      WHERE 1 = 1
        {{ params && params.status && params.status !== 'all' ? "AND j.status = '" + params.status + "'" : "" }}
        {{ params && params.entityType && params.entityType !== 'all' ? "AND j.entity_type = '" + params.entityType + "'" : "" }}
        {{ params && params.fluxoId && params.fluxoId !== 'all' ? "AND j.fluxo_id = " + Number(params.fluxoId) : "" }}
        {{ params && params.searchTerm ? "AND ent.entity_name ILIKE '%" + params.searchTerm + "%'" : "" }}
        {{ params && params.apenasAtrasadas ? "AND COALESCE(agg.atrasadas, 0) > 0" : "" }}
      ORDER BY COALESCE(agg.atrasadas, 0) DESC, ent.entity_name, j.id;
    `,
  });
}

export default loadJornadas;
