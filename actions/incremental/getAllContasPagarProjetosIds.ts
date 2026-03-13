import { action } from '@uibakery/data';

function getAllContasPagarProjetosIds() {
  return action('getAllContasPagarProjetosIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM contas_pagar_projetos 
      ORDER BY id;
    `,
  });
}

export default getAllContasPagarProjetosIds;
