import { action } from '@uibakery/data';

/** Linha do tempo de status de uma etapa — a matéria-prima do relatório de gargalo. */
function loadJornadaEtapaHistorico() {
  return action('loadJornadaEtapaHistorico', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        h.id,
        h.item_id,
        h.status_anterior,
        h.status_novo,
        h.dias_no_status,
        h.observacao,
        h.created_at,
        u.name AS user_nome,
        fe.nome AS etapa_nome
      FROM jornada_etapa_historico h
      LEFT JOIN users u ON u.id = h.user_id
      LEFT JOIN jornada_etapa_itens i ON i.id = h.item_id
      LEFT JOIN jornada_fluxo_etapas fe ON fe.id = i.fluxo_etapa_id
      WHERE h.jornada_id = {{ params && params.jornadaId ? Number(params.jornadaId) : "NULL" }}
        {{ params && params.itemId ? "AND h.item_id = " + Number(params.itemId) : "" }}
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT 200;
    `,
  });
}

export default loadJornadaEtapaHistorico;
