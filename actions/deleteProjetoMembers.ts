import { action } from '@uibakery/data';

function deleteProjetoMembers() {
  return action('deleteProjetoMembers', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM projeto_members WHERE projeto_id = {{params.projetoId}};
    `,
  });
}

export default deleteProjetoMembers;
