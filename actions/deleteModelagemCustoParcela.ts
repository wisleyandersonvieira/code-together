import { action } from '@uibakery/data';

/** Remove uma parcela de custo. */
function deleteModelagemCustoParcela() {
  return action('deleteModelagemCustoParcela', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_custo_parcelas WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemCustoParcela;
