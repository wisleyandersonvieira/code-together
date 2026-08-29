import { action } from '@uibakery/data';

/** Reverte a modelagem inteira para automático. */
function deleteModelagemOverridesTodos() {
  return action('deleteModelagemOverridesTodos', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_overrides
      WHERE modelagem_id = {{params.modelagemId}}::int
        AND cenario_id = {{params.cenarioId}}::int
    `,
  });
}

export default deleteModelagemOverridesTodos;
