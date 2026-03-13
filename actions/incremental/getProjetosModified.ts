import { action } from '@uibakery/data';

function getProjetosModified() {
  return action('getProjetosModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projetos
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getProjetosModified;
