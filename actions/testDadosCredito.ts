import { action } from '@uibakery/data';

function testDadosCredito() {
  return action('testDadosCredito', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Primeiro: ver quantos subgrupos com função CRÉDITO existem
      SELECT 
        'SUBGRUPOS_CREDITO' as tipo,
        COUNT(*) as quantidade
      FROM subgrupos_contabeis 
      WHERE funcao = 'CRÉDITO'
      
      UNION ALL
      
      -- Segundo: ver quantos produtos existem
      SELECT 
        'PRODUTOS_TOTAL' as tipo,
        COUNT(*) as quantidade
      FROM produtos
      
      UNION ALL
      
      -- Terceiro: ver quantos produtos têm subgrupo_id preenchido
      SELECT 
        'PRODUTOS_COM_SUBGRUPO' as tipo,
        COUNT(*) as quantidade
      FROM produtos 
      WHERE subgrupo_id IS NOT NULL;
    `,
  });
}

export default testDadosCredito;
