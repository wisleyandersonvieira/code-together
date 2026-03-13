import { action } from '@uibakery/data';

function createGrupoMember() {
  return action('createGrupoMember', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupo_members (
        grupo_id, 
        {{ params.clienteId ? 'cliente_id,' : '' }}
        {{ params.empresaId ? 'empresa_id,' : '' }}
        percentage
      )
      VALUES (
        {{params.grupoId}},
        {{ params.clienteId ? params.clienteId + ',' : '' }}
        {{ params.empresaId ? params.empresaId + ',' : '' }}
        {{params.percentage}}
      );
    `,
  });
}

export default createGrupoMember;
