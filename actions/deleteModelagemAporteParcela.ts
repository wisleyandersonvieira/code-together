import { action } from '@uibakery/data';

/** Remove uma parcela do plano de aportes. */
function deleteModelagemAporteParcela() {
  return action('deleteModelagemAporteParcela', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_aporte_parcelas WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemAporteParcela;
