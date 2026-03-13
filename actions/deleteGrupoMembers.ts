import { action } from '@uibakery/data';

function deleteGrupoMembers() {
  return action('deleteGrupoMembers', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM grupo_members WHERE grupo_id = {{params.grupoId}};
    `,
  });
}

export default deleteGrupoMembers;
