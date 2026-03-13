import { action } from '@uibakery/data';

function getClientesModified() {
  return action('getClientesModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM clientes
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getClientesModified;
