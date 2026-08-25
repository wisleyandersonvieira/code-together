import { action } from '@uibakery/data';

/** Carga aberta por responsável — quem está afogado e quem está livre. */
function loadOperacaoRelatorioCarga() {
  return action('loadOperacaoRelatorioCarga', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        t.responsavel_user_id,
        COALESCE(t.responsavel_nome, 'Sem responsável') AS responsavel_nome,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t.origem = 'ETAPA') AS etapas,
        COUNT(*) FILTER (WHERE t.origem = 'OBRIGACAO') AS obrigacoes,
        COUNT(*) FILTER (WHERE t.dias_atraso > 0 AND NOT t.aguardando) AS atrasadas,
        COUNT(*) FILTER (WHERE t.dias_atraso BETWEEN -7 AND 0) AS proximos_7,
        COUNT(*) FILTER (WHERE t.aguardando) AS aguardando,
        MAX(t.dias_atraso) FILTER (WHERE NOT t.aguardando) AS pior_atraso,
        COUNT(DISTINCT t.entity_id || '-' || t.entity_type) AS clientes
      FROM vw_operacao_tarefas t
      WHERE 1 = 1
        {{ params && params.setor && params.setor !== 'all' ? "AND t.setor = '" + params.setor + "'" : "" }}
      GROUP BY t.responsavel_user_id, t.responsavel_nome
      ORDER BY atrasadas DESC, total DESC;
    `,
  });
}

export default loadOperacaoRelatorioCarga;
