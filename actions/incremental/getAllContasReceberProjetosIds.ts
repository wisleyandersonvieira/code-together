import { action } from '@uibakery/data';

function getAllContasReceberProjetosIds() {
  return action('getAllContasReceberProjetosIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM contas_receber_projetos 
      ORDER BY id;
    `,
  });
}

export default getAllContasReceberProjetosIds;
