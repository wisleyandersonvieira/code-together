import { action } from '@uibakery/data';

function updateProjeto() {
  return action('updateProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE projetos 
      SET name = {{ params.name ? "'" + params.name + "'" : "NULL" }},
          address = {{ params.address ? "'" + params.address + "'" : "NULL" }},
          city = {{ params.city ? "'" + params.city + "'" : "NULL" }},
          construction_sqft = {{params.constructionSqft || "NULL"}},
          land_sqft = {{params.landSqft || "NULL"}},
          details = {{ params.details ? "'" + params.details + "'" : "NULL" }},
          predicted_sale_value = {{params.predictedSaleValue || "NULL"}},
          status = {{ params.status ? "'" + params.status + "'" : "NULL" }},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, name, address, city, construction_sqft, land_sqft, details, predicted_sale_value, status, created_at, updated_at;
    `,
  });
}

export default updateProjeto;
