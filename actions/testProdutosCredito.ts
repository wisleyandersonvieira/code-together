import { action } from '@uibakery/data';

function testProdutosCredito() {
  return action('testProdutosCredito', 'SQL', {
    databaseName: 'provision',
    query: `
      -- First, let's see all products and their subgroup functions
      SELECT 
        'Produtos com subgrupos' as query_type,
        p.id,
        p.codigo,
        p.descricao,
        p.tipo,
        p.subgrupo_id,
        sc.descricao as subgrupo_descricao,
        sc.funcao as subgrupo_funcao
      FROM produtos p
      LEFT JOIN subgrupos_contabeis sc ON p.subgrupo_id = sc.id
      ORDER BY p.codigo
      
      UNION ALL
      
      -- Show available subgrupos with their functions
      SELECT 
        'Subgrupos disponíveis' as query_type,
        sc.id,
        NULL as codigo,
        sc.descricao,
        sc.funcao as tipo,
        NULL as subgrupo_id,
        NULL as subgrupo_descricao,
        sc.funcao as subgrupo_funcao
      FROM subgrupos_contabeis sc
      ORDER BY sc.descricao;
    `,
  });
}

export default testProdutosCredito;
