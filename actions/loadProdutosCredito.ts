import { action } from '@uibakery/data';

function loadProdutosCredito() {
  return action('loadProdutosCredito', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id,
        p.codigo,
        p.descricao,
        p.tipo,
        p.grupo_id,
        p.subgrupo_id,
        sc.funcao,
        sc.descricao as subgrupo_descricao
      FROM produtos p
      INNER JOIN subgrupos_contabeis sc ON sc.id = p.subgrupo_id 
      WHERE UPPER(TRIM(sc.funcao)) = 'CRÉDITO'
      ORDER BY p.codigo;
    `,
  });
}

export default loadProdutosCredito;
