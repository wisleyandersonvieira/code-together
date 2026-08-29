import { action } from '@uibakery/data';

function deleteModelagemSocio() {
  return action('deleteModelagemSocio', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_socios WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemSocio;
