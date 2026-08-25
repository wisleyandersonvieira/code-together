import { action } from '@uibakery/data';

/**
 * Onde a operação trava. Separa o tempo em duas colunas honestas:
 *   dias_equipe    → relógio rodando com a bola no nosso pé
 *   dias_terceiros → tempo aguardando cliente ou órgão (SLA pausado)
 * Sem essa separação a média mente sempre que o cliente demora a responder.
 */
function loadOperacaoRelatorioGargalo() {
  return action('loadOperacaoRelatorioGargalo', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        f.id AS fluxo_id,
        f.nome AS fluxo_nome,
        fe.id AS etapa_id,
        fe.nome AS etapa_nome,
        fe.ordem,
        fe.setor,
        fe.prazo_dias,
        COUNT(*) FILTER (WHERE i.status = 'CONCLUIDA') AS concluidas,
        ROUND(AVG(i.data_conclusao - i.data_inicio)
          FILTER (WHERE i.status = 'CONCLUIDA' AND i.data_inicio IS NOT NULL), 1) AS dias_total,
        ROUND(AVG(GREATEST(i.data_conclusao - i.data_inicio - i.dias_pausados, 0))
          FILTER (WHERE i.status = 'CONCLUIDA' AND i.data_inicio IS NOT NULL), 1) AS dias_equipe,
        ROUND(AVG(i.dias_pausados)
          FILTER (WHERE i.status = 'CONCLUIDA'), 1) AS dias_terceiros,
        COUNT(*) FILTER (WHERE i.status = 'CONCLUIDA' AND i.data_limite IS NOT NULL
          AND i.data_conclusao <= i.data_limite) AS no_prazo,
        COUNT(*) FILTER (WHERE i.status = 'CONCLUIDA' AND i.data_limite IS NOT NULL) AS com_prazo,
        COUNT(*) FILTER (WHERE i.status IN ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')) AS em_aberto,
        COUNT(*) FILTER (WHERE i.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')) AS travadas_terceiros,
        COUNT(*) FILTER (WHERE i.status NOT IN ('CONCLUIDA', 'NAO_APLICAVEL')
          AND i.data_limite IS NOT NULL AND i.data_limite < CURRENT_DATE) AS atrasadas,
        ROUND(AVG(CURRENT_DATE - i.data_inicio)
          FILTER (WHERE i.status IN ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')
            AND i.data_inicio IS NOT NULL), 1) AS dias_parado_agora
      FROM jornada_fluxo_etapas fe
      JOIN jornada_fluxos f ON f.id = fe.fluxo_id
      LEFT JOIN jornada_etapa_itens i ON i.fluxo_etapa_id = fe.id
      LEFT JOIN jornadas j ON j.id = i.jornada_id
      WHERE 1 = 1
        {{ params && params.fluxoId && params.fluxoId !== 'all' ? "AND f.id = " + Number(params.fluxoId) : "" }}
        {{ params && params.dataInicio ? "AND (i.data_inicio IS NULL OR i.data_inicio >= '" + params.dataInicio + "')" : "" }}
        {{ params && params.dataFim ? "AND (i.data_inicio IS NULL OR i.data_inicio <= '" + params.dataFim + "')" : "" }}
      GROUP BY f.id, f.nome, fe.id, fe.nome, fe.ordem, fe.setor, fe.prazo_dias
      HAVING COUNT(i.id) > 0
      ORDER BY atrasadas DESC, dias_equipe DESC NULLS LAST, f.nome, fe.ordem;
    `,
  });
}

export default loadOperacaoRelatorioGargalo;
