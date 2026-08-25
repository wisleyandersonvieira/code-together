import { action } from '@uibakery/data';

/**
 * Etapas da jornada com tudo o que a tela precisa numa consulta só: SLA já
 * calculado, checklist agregado em JSON e a contagem de anexos.
 */
function loadJornadaEtapaItens() {
  return action('loadJornadaEtapaItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        i.id AS item_id,
        i.fluxo_etapa_id,
        fe.nome AS etapa_nome,
        fe.descricao AS etapa_descricao,
        fe.ativo AS etapa_ativa,
        fe.setor,
        i.ordem,
        i.status,
        i.prazo_dias,
        i.data_prevista,
        i.data_inicio,
        i.data_limite,
        i.data_conclusao,
        i.dias_pausados,
        i.pausado_em,
        i.aguardando_motivo,
        i.status_desde,
        (CURRENT_DATE - i.status_desde) AS dias_no_status,
        CASE
          WHEN i.data_limite IS NULL THEN NULL
          ELSE (CURRENT_DATE - i.data_limite)
        END AS dias_atraso,
        i.responsavel_user_id,
        u.name AS responsavel_nome,
        i.observacoes,
        i.checklist_total,
        i.checklist_concluidos,
        (SELECT COUNT(*) FROM files fl WHERE fl.entity_type = 'jornada_item' AND fl.entity_id = i.id) AS total_anexos,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', c.id,
                'descricao', c.descricao,
                'ordem', c.ordem,
                'obrigatorio', c.obrigatorio,
                'concluido', c.concluido,
                'concluido_em', c.concluido_em,
                'concluido_por', cu.name,
                'avulso', (c.fluxo_checklist_id IS NULL)
              ) ORDER BY c.ordem, c.id
            )
            FROM jornada_item_checklist c
            LEFT JOIN users cu ON cu.id = c.concluido_por_user_id
            WHERE c.item_id = i.id
          ),
          '[]'::json
        ) AS checklist
      FROM jornada_etapa_itens i
      JOIN jornada_fluxo_etapas fe ON fe.id = i.fluxo_etapa_id
      LEFT JOIN users u ON u.id = i.responsavel_user_id
      WHERE i.jornada_id = {{ params && params.jornadaId ? Number(params.jornadaId) : "NULL" }}
      ORDER BY i.ordem, i.id;
    `,
  });
}

export default loadJornadaEtapaItens;
