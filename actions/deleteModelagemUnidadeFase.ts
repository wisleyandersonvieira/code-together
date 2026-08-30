import { action } from '@uibakery/data';

/**
 * Remove a alocação de uma tipologia numa fase.
 *
 * Por (unidade_id, fase_id), a mesma chave do upsert: a matriz da tela não
 * carrega o id da linha de junção, ela conhece o par.
 */
function deleteModelagemUnidadeFase() {
  return action('deleteModelagemUnidadeFase', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_unidade_fases
      WHERE unidade_id = {{params.unidadeId}}::int
        AND fase_id = {{params.faseId}}::int
    `,
  });
}

export default deleteModelagemUnidadeFase;
