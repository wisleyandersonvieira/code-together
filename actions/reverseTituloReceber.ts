import { action } from '@uibakery/data';

function reverseTituloReceber() {
  return action('reverseTituloReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE titulos_receber 
      SET 
        valor_recebido = 0,
        data_recebimento = NULL,
        conta_id = NULL,
        observacoes_recebimento = NULL,
        status = 'PENDENTE',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default reverseTituloReceber;
