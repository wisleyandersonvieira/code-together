import { action } from '@uibakery/data';

function updateTitulosValor() {
  return action('updateTitulosValor', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH titulo_info AS (
        SELECT 
          tp.id,
          tp.conta_pagar_id,
          tp.parcela,
          tp.total_parcelas,
          tp.status,
          ({{params.novoValorTotal}} / tp.total_parcelas) as novo_valor_parcela
        FROM titulos_pagar tp
        WHERE tp.conta_pagar_id = {{params.contaPagarId}}
          AND tp.status = 'PENDENTE'
      )
      UPDATE titulos_pagar 
      SET 
        valor = titulo_info.novo_valor_parcela,
        updated_at = CURRENT_TIMESTAMP
      FROM titulo_info 
      WHERE titulos_pagar.id = titulo_info.id;
    `,
  });
}

export default updateTitulosValor;

