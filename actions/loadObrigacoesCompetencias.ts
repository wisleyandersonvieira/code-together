import { action } from '@uibakery/data';

/**
 * Competências geradas. `situacao` filtra pela cobrança:
 *   atrasadas | vence_hoje | proximos_7 | aguardando | abertas | entregues
 */
function loadObrigacoesCompetencias() {
  return action('loadObrigacoesCompetencias', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        k.id,
        k.obrigacao_cliente_id,
        oc.entity_type,
        oc.entity_id,
        ent.entity_name,
        o.nome AS obrigacao_nome,
        o.periodicidade,
        o.setor,
        k.competencia_ano,
        k.competencia_mes,
        k.competencia_label,
        k.data_vencimento,
        k.data_limite_interna,
        k.status,
        k.data_entrega,
        k.protocolo,
        k.observacoes,
        k.aguardando_motivo,
        k.dias_pausados,
        k.pausado_em,
        (CURRENT_DATE - k.data_vencimento) AS dias_atraso,
        (CURRENT_DATE - k.data_limite_interna) AS dias_atraso_interno,
        COALESCE(k.responsavel_user_id, oc.responsavel_user_id) AS responsavel_user_id,
        u.name AS responsavel_nome,
        (k.status = 'ENTREGUE' AND k.data_entrega <= k.data_vencimento) AS entregue_no_prazo
      FROM obrigacoes_competencias k
      JOIN obrigacoes_cliente oc ON oc.id = k.obrigacao_cliente_id
      JOIN obrigacoes_catalogo o ON o.id = oc.obrigacao_id
      LEFT JOIN users u ON u.id = COALESCE(k.responsavel_user_id, oc.responsavel_user_id)
      LEFT JOIN vw_operacao_entidades ent
        ON ent.entity_type = oc.entity_type AND ent.entity_id = oc.entity_id
      WHERE 1 = 1
        {{ params && params.entityId ? "AND oc.entity_id = " + Number(params.entityId) : "" }}
        {{ params && params.entityType && params.entityType !== 'all' ? "AND oc.entity_type = '" + params.entityType + "'" : "" }}
        {{ params && params.obrigacaoId && params.obrigacaoId !== 'all' ? "AND oc.obrigacao_id = " + Number(params.obrigacaoId) : "" }}
        {{ params && params.responsavelId && params.responsavelId !== 'all' ? "AND COALESCE(k.responsavel_user_id, oc.responsavel_user_id) = " + Number(params.responsavelId) : "" }}
        {{ params && params.status && params.status !== 'all' ? "AND k.status = '" + params.status + "'" : "" }}
        {{ params && params.competenciaAno && params.competenciaAno !== 'all' ? "AND k.competencia_ano = " + Number(params.competenciaAno) : "" }}
        {{ params && params.competenciaMes && params.competenciaMes !== 'all' ? "AND k.competencia_mes = " + Number(params.competenciaMes) : "" }}
        {{ params && params.searchTerm ? "AND (ent.entity_name ILIKE '%" + params.searchTerm + "%' OR o.nome ILIKE '%" + params.searchTerm + "%')" : "" }}
        {{ params && params.situacao === 'atrasadas' ? "AND k.status NOT IN ('ENTREGUE','DISPENSADA') AND k.data_vencimento < CURRENT_DATE" : "" }}
        {{ params && params.situacao === 'vence_hoje' ? "AND k.status NOT IN ('ENTREGUE','DISPENSADA') AND k.data_vencimento = CURRENT_DATE" : "" }}
        {{ params && params.situacao === 'proximos_7' ? "AND k.status NOT IN ('ENTREGUE','DISPENSADA') AND k.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7" : "" }}
        {{ params && params.situacao === 'aguardando' ? "AND k.status IN ('AGUARDANDO_CLIENTE','AGUARDANDO_ORGAO')" : "" }}
        {{ params && params.situacao === 'abertas' ? "AND k.status NOT IN ('ENTREGUE','DISPENSADA')" : "" }}
        {{ params && params.situacao === 'entregues' ? "AND k.status = 'ENTREGUE'" : "" }}
      ORDER BY k.data_vencimento, ent.entity_name, o.nome
      LIMIT {{ params && params.limite ? Number(params.limite) : 500 }};
    `,
  });
}

export default loadObrigacoesCompetencias;
