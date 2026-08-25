import { action } from '@uibakery/data';

/**
 * Contadores do sino e dos cartões do painel. Opcionalmente restrito a um
 * responsável (é assim que a caixa "Minhas Tarefas" mostra o próprio número).
 */
function loadOperacaoResumo() {
  return action('loadOperacaoResumo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        COUNT(*) FILTER (WHERE t.dias_atraso > 0 AND NOT t.aguardando) AS atrasadas,
        COUNT(*) FILTER (WHERE t.dias_atraso = 0) AS vence_hoje,
        COUNT(*) FILTER (WHERE t.dias_atraso BETWEEN -7 AND -1) AS proximos_7,
        COUNT(*) FILTER (WHERE t.aguardando) AS aguardando,
        COUNT(*) FILTER (WHERE t.responsavel_user_id IS NULL) AS sem_responsavel,
        COUNT(*) FILTER (WHERE t.origem = 'ETAPA') AS etapas,
        COUNT(*) FILTER (WHERE t.origem = 'OBRIGACAO') AS obrigacoes,
        COUNT(*) AS total
      FROM vw_operacao_tarefas t
      WHERE 1 = 1
        {{ params && params.responsavelId && params.responsavelId !== 'all' ? "AND t.responsavel_user_id = " + Number(params.responsavelId) : "" }};
    `,
  });
}

export default loadOperacaoResumo;
