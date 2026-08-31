import { action } from '@uibakery/data';

/** Remove um aporte de sócio. */
function deleteModelagemSocioAporte() {
  return action('deleteModelagemSocioAporte', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_socio_aportes WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemSocioAporte;
