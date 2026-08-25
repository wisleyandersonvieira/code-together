import { action } from '@uibakery/data';

/** Etapas de um fluxo, cada uma com o checklist modelo agregado em JSON. */
function loadJornadaFluxoEtapas() {
  return action('loadJornadaFluxoEtapas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        fe.id,
        fe.nome,
        fe.descricao,
        fe.ordem,
        fe.prazo_dias,
        fe.setor,
        fe.responsavel_padrao_user_id,
        fe.ativo,
        (SELECT COUNT(*) FROM jornada_etapa_itens i WHERE i.fluxo_etapa_id = fe.id) AS em_uso,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', fc.id,
                'descricao', fc.descricao,
                'ordem', fc.ordem,
                'obrigatorio', fc.obrigatorio
              ) ORDER BY fc.ordem, fc.id
            )
            FROM jornada_fluxo_checklist fc
            WHERE fc.fluxo_etapa_id = fe.id
          ),
          '[]'::json
        ) AS checklist
      FROM jornada_fluxo_etapas fe
      WHERE fe.fluxo_id = {{ params && params.fluxoId ? Number(params.fluxoId) : "NULL" }}
      ORDER BY fe.ordem, fe.id;
    `,
  });
}

export default loadJornadaFluxoEtapas;
