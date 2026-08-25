import { action } from '@uibakery/data';

/**
 * Quem está segurando a operação por fora. Enquanto essa lista cresce, o SLA da
 * equipe fica parado — é aqui que se cobra o cliente ou o órgão.
 */
function loadOperacaoRelatorioAguardando() {
  return action('loadOperacaoRelatorioAguardando', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        t.origem,
        t.referencia_id,
        t.jornada_id,
        t.entity_type,
        t.entity_id,
        t.cliente_nome,
        t.titulo,
        t.contexto,
        t.setor,
        t.status,
        t.aguardando_motivo,
        t.responsavel_nome,
        t.data_limite,
        t.dias_parados,
        t.dias_no_status
      FROM vw_operacao_tarefas t
      WHERE t.aguardando = TRUE
        {{ params && params.status && params.status !== 'all' ? "AND t.status = '" + params.status + "'" : "" }}
        {{ params && params.responsavelId && params.responsavelId !== 'all' ? "AND t.responsavel_user_id = " + Number(params.responsavelId) : "" }}
      ORDER BY t.dias_no_status DESC, t.cliente_nome
      LIMIT 200;
    `,
  });
}

export default loadOperacaoRelatorioAguardando;
