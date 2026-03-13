import { action } from '@uibakery/data';

function getGruposContabeisModified() {
  return action('getGruposContabeisModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM grupos_contabeis
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getGruposContabeisModified;
