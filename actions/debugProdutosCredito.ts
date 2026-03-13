import { action } from '@uibakery/data';

function debugProdutosCredito() {
  return action('debugProdutosCredito', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Ver todos os produtos
      SELECT 
        'PRODUTOS' as tipo,
        p.id::text as id_str,
        p.codigo,
        p.descricao,
        p.subgrupo_id::text as subgrupo_id_str
      FROM produtos p
      ORDER BY p.id
      
      UNION ALL
      
      -- Ver todos os subgrupos
      SELECT 
        'SUBGRUPOS' as tipo,
        sc.id::text as id_str,
        sc.descricao as codigo,
        sc.funcao as descricao,
        sc.grupo_id::text as subgrupo_id_str
      FROM subgrupos_contabeis sc
      ORDER BY sc.id;
    `,
  });
}

export default debugProdutosCredito;
