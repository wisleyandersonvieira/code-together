import { action } from '@uibakery/data';

function testProdutosCreditoNow() {
  return action('testProdutosCreditoNow', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Ver primeiro todos os subgrupos e suas funções
      SELECT 
        'SUBGRUPOS' as origem,
        id::text as produto_id,
        descricao as produto_descricao,
        funcao as produto_tipo,
        '' as subgrupo_funcao
      FROM subgrupos_contabeis
      
      UNION ALL
      
      -- Ver todos os produtos com seus subgrupos
      SELECT 
        'PRODUTOS' as origem,
        p.id::text,
        p.descricao,
        p.tipo,
        COALESCE(sc.funcao, '') as subgrupo_funcao
      FROM produtos p
      LEFT JOIN subgrupos_contabeis sc ON sc.id = p.subgrupo_id;
    `,
  });
}

export default testProdutosCreditoNow;
