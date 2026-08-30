import { action } from '@uibakery/data';

/** Remove uma fase. As alocações de unidade por fase caem junto, por CASCADE. */
function deleteModelagemFase() {
  return action('deleteModelagemFase', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_fases WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemFase;
