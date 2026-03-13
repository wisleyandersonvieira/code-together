import { action } from '@uibakery/data';

function updateProduto() {
  return action('updateProduto', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE produtos 
      SET 
        descricao = '{{params.descricao}}', 
        tipo = '{{params.tipo}}', 
        grupo_id = {{params.grupo_id}}, 
        subgrupo_id = {{params.subgrupo_id}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING *;
    `,
  });
}

export default updateProduto;
