import { action } from '@uibakery/data';

function updateTitulosReceberValor() {
  return action('updateTitulosReceberValor', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE titulos_receber 
      SET 
        valor = ROUND({{params.novo_valor_total}} * (valor / NULLIF({{params.antigo_valor_total}}, 0)), 2),
        updated_at = CURRENT_TIMESTAMP
      WHERE conta_receber_id = {{params.conta_receber_id}}
        AND status = 'PENDENTE';
    `,
  });
}

export default updateTitulosReceberValor;
