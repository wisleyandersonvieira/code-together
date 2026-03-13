import { action } from '@uibakery/data';

function insertProjetos() {
  return action('insertProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projetos (id, name, address, city, construction_sqft, land_sqft, details, predicted_sale_value, photo_urls, created_at, updated_at, document_urls, status, kanban_column_id, kanban_position)
      VALUES {{ 
        params.projetos.map(p => 
          "(" + 
          p.id + ", " +
          (p.name ? "'" + p.name.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (p.address ? "'" + p.address.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (p.city ? "'" + p.city.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (p.construction_sqft !== null ? p.construction_sqft : "NULL") + ", " +
          (p.land_sqft !== null ? p.land_sqft : "NULL") + ", " +
          (p.details ? "'" + p.details.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (p.predicted_sale_value !== null ? p.predicted_sale_value : "NULL") + ", " +
          (p.photo_urls && p.photo_urls.length > 0 ? "ARRAY[" + p.photo_urls.map(url => "'" + url.replace(/'/g, "''") + "'").join(', ') + "]" : "NULL") + ", " +
          (p.created_at ? "'" + p.created_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (p.updated_at ? "'" + p.updated_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (p.document_urls && p.document_urls.length > 0 ? "ARRAY[" + p.document_urls.map(url => "'" + url.replace(/'/g, "''") + "'").join(', ') + "]" : "NULL") + ", " +
          (p.status ? "'" + p.status.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (p.kanban_column_id !== null ? p.kanban_column_id : "NULL") + ", " +
          (p.kanban_position !== null ? p.kanban_position : "NULL") +
          ")"
        ).join(', ') 
      }}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        construction_sqft = EXCLUDED.construction_sqft,
        land_sqft = EXCLUDED.land_sqft,
        details = EXCLUDED.details,
        predicted_sale_value = EXCLUDED.predicted_sale_value,
        photo_urls = EXCLUDED.photo_urls,
        updated_at = CURRENT_TIMESTAMP,
        document_urls = EXCLUDED.document_urls,
        status = EXCLUDED.status,
        kanban_column_id = EXCLUDED.kanban_column_id,
        kanban_position = EXCLUDED.kanban_position;
    `,
  });
}

export default insertProjetos;
