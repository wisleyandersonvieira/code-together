import { action } from '@uibakery/data';

function getContasPagarProjetosModified() {
  return action('getContasPagarProjetosModified', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_pagar_projetos
      WHERE 
        {{params.lastSync}} IS NULL
        OR updated_at > {{params.lastSync}}::timestamp
      ORDER BY updated_at ASC
      LIMIT COALESCE({{params.limit}}::int, 1000);
    `,
  });
}

export default getContasPagarProjetosModified;
