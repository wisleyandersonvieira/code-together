import { action } from '@uibakery/data';

function extractGrupoMembers() {
  return action('extractGrupoMembers', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM grupo_members
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractGrupoMembers;
