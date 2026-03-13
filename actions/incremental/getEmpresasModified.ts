import { action } from '@uibakery/data';

function getEmpresasModified() {
  return action('getEmpresasModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM empresas
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getEmpresasModified;
