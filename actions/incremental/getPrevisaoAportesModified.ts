import { action } from '@uibakery/data';

function getPrevisaoAportesModified() {
  return action('getPrevisaoAportesModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM previsao_aportes
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getPrevisaoAportesModified;
