import { action } from '@uibakery/data';

function deleteContaReceberProjetos() {
  return action('deleteContaReceberProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_receber_projetos WHERE conta_receber_id = {{params.contaReceberId}};
    `,
  });
}

export default deleteContaReceberProjetos;
