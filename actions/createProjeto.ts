import { action } from '@uibakery/data';

function createProjeto() {
  return action('createProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH first_column AS (
        SELECT kc.id, COALESCE(MAX(p.kanban_position), 0) + 1 as next_position
        FROM kanban_columns kc
        LEFT JOIN projetos p ON kc.id = p.kanban_column_id
        WHERE kc.position = (SELECT MIN(position) FROM kanban_columns)
        GROUP BY kc.id
        LIMIT 1
      )
      INSERT INTO projetos (name, address, city, construction_sqft, land_sqft, details, predicted_sale_value, status, kanban_column_id, kanban_position)
      SELECT {{ params.name ? "'" + params.name + "'" : "NULL" }}, 
             {{ params.address ? "'" + params.address + "'" : "NULL" }}, 
             {{ params.city ? "'" + params.city + "'" : "NULL" }}, 
             {{params.constructionSqft || "NULL"}}, 
             {{params.landSqft || "NULL"}}, 
             {{ params.details ? "'" + params.details + "'" : "NULL" }}, 
             {{params.predictedSaleValue || "NULL"}}, 
             {{ params.status ? "'" + params.status + "'" : "NULL" }},
             fc.id, fc.next_position
      FROM first_column fc
      RETURNING id, name, address, city, construction_sqft, land_sqft, details, predicted_sale_value, status, kanban_column_id, kanban_position, created_at, updated_at;
    `,
  });
}

export default createProjeto;
