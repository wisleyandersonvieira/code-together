import { action } from '@uibakery/data';

function getMatrizSociosModified() {
  return action('getMatrizSociosModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM matriz_socios
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getMatrizSociosModified;
