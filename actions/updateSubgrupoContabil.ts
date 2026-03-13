import { action } from '@uibakery/data';

function updateSubgrupoContabil() {
  return action('updateSubgrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE subgrupos_contabeis 
      SET descricao = '{{params.descricao}}',
          grupo_id = {{params.grupoId}},
          funcao = '{{params.funcao}}',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING *;
    `,
  });
}

export default updateSubgrupoContabil;
