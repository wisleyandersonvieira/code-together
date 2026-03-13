import { action } from '@uibakery/data';

function updateEmpresa() {
  return action('updateEmpresa', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE empresas 
      SET 
        name = {{params.name ? "'" + params.name.replace(/'/g, "''") + "'" : "NULL"}}, 
        number = {{params.number ? "'" + params.number.replace(/'/g, "''") + "'" : "NULL"}}, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, name, number, file_urls, created_at, updated_at;
    `,
  });
}

export default updateEmpresa;
