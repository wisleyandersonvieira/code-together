import { action } from '@uibakery/data';

function updateTituloPagar() {
  return action('updateTituloPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE titulos_pagar 
      SET 
        data_vencimento = {{params.dataVencimento}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING id, data_vencimento;
    `,
  });
}

export default updateTituloPagar;
