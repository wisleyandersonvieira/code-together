import { action } from '@uibakery/data';

/** Reverte uma linha inteira do fluxo para automático. */
function deleteModelagemOverridesLinha() {
  return action('deleteModelagemOverridesLinha', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_overrides
      WHERE modelagem_id = {{params.modelagemId}}::int
        AND cenario_id = {{params.cenarioId}}::int
        AND linha = '{{params.linha}}'
    `,
  });
}

export default deleteModelagemOverridesLinha;
