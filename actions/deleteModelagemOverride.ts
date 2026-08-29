import { action } from '@uibakery/data';

/** Reverte uma célula para o valor automático. */
function deleteModelagemOverride() {
  return action('deleteModelagemOverride', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_overrides
      WHERE modelagem_id = {{params.modelagemId}}::int
        AND cenario_id = {{params.cenarioId}}::int
        AND mes = {{params.mes}}::int
        AND linha = '{{params.linha}}'
    `,
  });
}

export default deleteModelagemOverride;
