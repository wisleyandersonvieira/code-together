import { action } from '@uibakery/data';

function loadEstruturaDreItens() {
  return action('loadEstruturaDreItens', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH item_hierarchy AS (
        SELECT 
          edi.id,
          edi.estrutura_dre_id,
          edi.tipo,
          edi.nome,
          edi.grupo_contabil_id,
          edi.subgrupo_contabil_id,
          edi.ordem,
          edi.nivel,
          edi.parent_id,
          gc.descricao as grupo_nome,
          gc.tipo as grupo_tipo,
          sc.descricao as subgrupo_nome,
          sc.funcao as subgrupo_funcao
        FROM estruturas_dre_itens edi
        LEFT JOIN grupos_contabeis gc ON edi.grupo_contabil_id = gc.id
        LEFT JOIN subgrupos_contabeis sc ON edi.subgrupo_contabil_id = sc.id
        WHERE edi.estrutura_dre_id = {{params.estruturaId}}
      )
      SELECT 
        ih.*,
        CASE 
          WHEN ih.tipo = 'SOMA' THEN (
            SELECT array_agg(DISTINCT referenced_item_id)
            FROM estruturas_dre_soma_itens edsi
            WHERE edsi.soma_item_id = ih.id
          )
          ELSE NULL
        END as soma_referencias
      FROM item_hierarchy ih
      ORDER BY ih.ordem ASC;
    `,
  });
}

export default loadEstruturaDreItens;
