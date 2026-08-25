import { action } from '@uibakery/data';

function loadJornadaEtapas() {
  return action('loadJornadaEtapas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        e.id,
        e.nome,
        e.descricao,
        e.ordem,
        e.ativo,
        e.created_at,
        e.updated_at,
        COUNT(i.id) AS jornadas_vinculadas
      FROM jornada_etapas e
      LEFT JOIN jornada_etapa_itens i ON i.etapa_id = e.id
      WHERE 1 = 1
        {{ params && params.apenasAtivas ? "AND e.ativo = true" : "" }}
        {{ params && params.searchTerm ? "AND e.nome ILIKE '%" + params.searchTerm + "%'" : "" }}
      GROUP BY e.id
      ORDER BY e.ordem, e.id;
    `,
  });
}

export default loadJornadaEtapas;
