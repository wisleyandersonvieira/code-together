import { action } from '@uibakery/data';

/** Fluxos com contagem de etapas e de jornadas em uso. */
function loadJornadaFluxos() {
  return action('loadJornadaFluxos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        f.id,
        f.nome,
        f.descricao,
        f.entity_type,
        f.avanco_automatico,
        f.padrao,
        f.ativo,
        COUNT(DISTINCT fe.id) FILTER (WHERE fe.ativo) AS total_etapas,
        COUNT(DISTINCT fc.id) AS total_checklist,
        (SELECT COUNT(*) FROM jornadas j WHERE j.fluxo_id = f.id) AS jornadas_vinculadas
      FROM jornada_fluxos f
      LEFT JOIN jornada_fluxo_etapas fe ON fe.fluxo_id = f.id
      LEFT JOIN jornada_fluxo_checklist fc ON fc.fluxo_etapa_id = fe.id
      WHERE 1 = 1
        {{ params && params.apenasAtivos ? "AND f.ativo = true" : "" }}
        {{ params && params.searchTerm ? "AND f.nome ILIKE '%" + params.searchTerm + "%'" : "" }}
      GROUP BY f.id
      ORDER BY f.padrao DESC, f.nome;
    `,
  });
}

export default loadJornadaFluxos;
