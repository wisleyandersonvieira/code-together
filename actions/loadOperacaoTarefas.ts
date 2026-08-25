import { action } from '@uibakery/data';

/**
 * Caixa de tarefas unificada: etapa de jornada e competência de obrigação no
 * mesmo formato. `situacao` recorta a cobrança do dia.
 */
function loadOperacaoTarefas() {
  return action('loadOperacaoTarefas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT *
      FROM vw_operacao_tarefas t
      WHERE 1 = 1
        {{ params && params.responsavelId && params.responsavelId !== 'all' ? "AND t.responsavel_user_id = " + Number(params.responsavelId) : "" }}
        {{ params && params.semResponsavel ? "AND t.responsavel_user_id IS NULL" : "" }}
        {{ params && params.origem && params.origem !== 'all' ? "AND t.origem = '" + params.origem + "'" : "" }}
        {{ params && params.setor && params.setor !== 'all' ? "AND t.setor = '" + params.setor + "'" : "" }}
        {{ params && params.entityType && params.entityType !== 'all' ? "AND t.entity_type = '" + params.entityType + "'" : "" }}
        {{ params && params.searchTerm ? "AND (t.cliente_nome ILIKE '%" + params.searchTerm + "%' OR t.titulo ILIKE '%" + params.searchTerm + "%')" : "" }}
        {{ params && params.situacao === 'atrasadas' ? "AND t.dias_atraso > 0 AND NOT t.aguardando" : "" }}
        {{ params && params.situacao === 'vence_hoje' ? "AND t.dias_atraso = 0" : "" }}
        {{ params && params.situacao === 'proximos_7' ? "AND t.dias_atraso BETWEEN -7 AND 0" : "" }}
        {{ params && params.situacao === 'aguardando' ? "AND t.aguardando" : "" }}
        {{ params && params.situacao === 'sem_prazo' ? "AND t.data_limite IS NULL" : "" }}
      ORDER BY
        t.aguardando,
        t.data_limite NULLS LAST,
        t.cliente_nome
      LIMIT {{ params && params.limite ? Number(params.limite) : 300 }};
    `,
  });
}

export default loadOperacaoTarefas;
