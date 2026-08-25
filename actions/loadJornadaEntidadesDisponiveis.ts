import { action } from '@uibakery/data';

/** Clientes, empresas e grupos que ainda não possuem jornada cadastrada. */
function loadJornadaEntidadesDisponiveis() {
  return action('loadJornadaEntidadesDisponiveis', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        entidades.id,
        entidades.name,
        entidades.entity_type,
        entidades.display_name
      FROM (
        SELECT c.id, c.name, 'cliente' AS entity_type, c.name AS display_name
        FROM clientes c
        WHERE c.active = true

        UNION ALL

        SELECT e.id, e.name, 'empresa' AS entity_type, CONCAT(e.name, ' (Empresa)') AS display_name
        FROM empresas e

        UNION ALL

        SELECT g.id, g.name, 'grupo' AS entity_type, CONCAT(g.name, ' (Grupo)') AS display_name
        FROM grupos g
      ) AS entidades
      WHERE NOT EXISTS (
        SELECT 1
        FROM jornadas j
        WHERE j.entity_type = entidades.entity_type
          AND j.entity_id = entidades.id
      )
      ORDER BY entidades.display_name;
    `,
  });
}

export default loadJornadaEntidadesDisponiveis;
