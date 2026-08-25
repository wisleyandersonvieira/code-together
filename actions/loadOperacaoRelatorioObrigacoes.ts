import { action } from '@uibakery/data';

/** Cumprimento das obrigações mês a mês: entregue no prazo, com atraso, em aberto. */
function loadOperacaoRelatorioObrigacoes() {
  return action('loadOperacaoRelatorioObrigacoes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        k.competencia_ano,
        k.competencia_mes,
        LPAD(k.competencia_mes::TEXT, 2, '0') || '/' || k.competencia_ano::TEXT AS competencia,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE k.status = 'ENTREGUE' AND k.data_entrega <= k.data_vencimento) AS no_prazo,
        COUNT(*) FILTER (WHERE k.status = 'ENTREGUE' AND k.data_entrega > k.data_vencimento) AS com_atraso,
        COUNT(*) FILTER (WHERE k.status = 'DISPENSADA') AS dispensadas,
        COUNT(*) FILTER (WHERE k.status NOT IN ('ENTREGUE', 'DISPENSADA')) AS em_aberto,
        COUNT(*) FILTER (WHERE k.status NOT IN ('ENTREGUE', 'DISPENSADA')
          AND k.data_vencimento < CURRENT_DATE) AS vencidas,
        COUNT(*) FILTER (WHERE k.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')) AS aguardando,
        ROUND(AVG(k.data_entrega - k.data_vencimento)
          FILTER (WHERE k.status = 'ENTREGUE' AND k.data_entrega > k.data_vencimento), 1) AS dias_atraso_medio
      FROM obrigacoes_competencias k
      JOIN obrigacoes_cliente oc ON oc.id = k.obrigacao_cliente_id
      JOIN obrigacoes_catalogo o ON o.id = oc.obrigacao_id
      WHERE 1 = 1
        {{ params && params.obrigacaoId && params.obrigacaoId !== 'all' ? "AND o.id = " + Number(params.obrigacaoId) : "" }}
        {{ params && params.responsavelId && params.responsavelId !== 'all' ? "AND COALESCE(k.responsavel_user_id, oc.responsavel_user_id) = " + Number(params.responsavelId) : "" }}
        {{ params && params.setor && params.setor !== 'all' ? "AND o.setor = '" + params.setor + "'" : "" }}
      GROUP BY k.competencia_ano, k.competencia_mes
      ORDER BY k.competencia_ano DESC, k.competencia_mes DESC
      LIMIT {{ params && params.limite ? Number(params.limite) : 24 }};
    `,
  });
}

export default loadOperacaoRelatorioObrigacoes;
