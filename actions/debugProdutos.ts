import { action } from '@uibakery/data';

function debugProdutos() {
  return action('debugProdutos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id,
        p.codigo,
        p.descricao,
        p.created_at
      FROM produtos p
      ORDER BY p.id DESC
      LIMIT 10;
    `,
  });
}

export default debugProdutos;
