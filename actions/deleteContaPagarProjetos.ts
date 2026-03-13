import { action } from '@uibakery/data';

function deleteContaPagarProjetos() {
  return action('deleteContaPagarProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_pagar_projetos
      WHERE conta_pagar_id = {{params.contaPagarId}};
    `,
  });
}

export default deleteContaPagarProjetos;
