import { action } from '@uibakery/data';

function createProduto() {
  return action('createProduto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO produtos (codigo, descricao, tipo, grupo_id, subgrupo_id)
      VALUES (
        LPAD((
          SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1
          FROM produtos 
          WHERE codigo ~ '^[0-9]+$'
        )::text, 6, '0'),
        '{{params.descricao}}', 
        '{{params.tipo}}', 
        {{params.grupo_id}}, 
        {{params.subgrupo_id}}
      )
      RETURNING *;
    `,
  });
}

export default createProduto;
