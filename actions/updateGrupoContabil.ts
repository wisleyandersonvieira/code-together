import { action } from '@uibakery/data';

function updateGrupoContabil() {
  return action('updateGrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE grupos_contabeis 
      SET descricao = '{{params.descricao}}',
          tipo = '{{params.tipo}}',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING *;
    `,
  });
}

export default updateGrupoContabil;
