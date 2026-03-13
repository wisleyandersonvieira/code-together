import { action } from '@uibakery/data';

function deleteOrcamentos() {
  return action('deleteOrcamentos', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM orcamentos 
      WHERE projeto_id = {{params.projetoId}};
    `,
  });
}

export default deleteOrcamentos;
