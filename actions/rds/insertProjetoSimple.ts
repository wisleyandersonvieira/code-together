import { action } from '@uibakery/data';

function insertProjetoSimple() {
  return action('insertProjetoSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projetos (id, name, address, city, construction_sqft, land_sqft, predicted_sale_value, status)
      VALUES ({{params.id}}, '{{params.name || ""}}', '{{params.address || ""}}', '{{params.city || ""}}', {{params.construction_sqft || "NULL"}}, {{params.land_sqft || "NULL"}}, {{params.predicted_sale_value || "NULL"}}, '{{params.status || "Planejamento"}}')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        construction_sqft = EXCLUDED.construction_sqft,
        land_sqft = EXCLUDED.land_sqft,
        predicted_sale_value = EXCLUDED.predicted_sale_value,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertProjetoSimple;
