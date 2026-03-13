import { action } from '@uibakery/data';

function deleteContaPagar() {
  return action('deleteContaPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas_pagar 
      WHERE id = {{params.id}}
      AND NOT EXISTS (
        SELECT 1 FROM titulos_pagar 
        WHERE conta_pagar_id = {{params.id}} 
        AND status = 'PAGO'
      );
    `,
  });
}

export default deleteContaPagar;
