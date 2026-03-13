import { action } from '@uibakery/data';

function deleteContaReceber() {
  return action('deleteContaReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Delete relacionados primeiro (caso as constraints CASCADE não funcionem)
      DELETE FROM titulos_receber WHERE conta_receber_id = {{params.id}};
      DELETE FROM contas_receber_faturamento WHERE conta_receber_id = {{params.id}};
      DELETE FROM contas_receber_projetos WHERE conta_receber_id = {{params.id}};
      DELETE FROM contas_receber_itens WHERE conta_receber_id = {{params.id}};
      DELETE FROM rateio_aportes WHERE conta_receber_id = {{params.id}};
      
      -- Delete a conta principal
      DELETE FROM contas_receber WHERE id = {{params.id}};
    `,
  });
}

export default deleteContaReceber;
