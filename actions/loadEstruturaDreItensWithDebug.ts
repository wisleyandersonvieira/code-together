import { action } from '@uibakery/data';

function loadEstruturaDreItensWithDebug() {
  return action('loadEstruturaDreItensWithDebug', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Debug query to check SOMA references
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
        *,
        CASE 
          WHEN tipo = 'SOMA' THEN (
            SELECT json_agg(
              json_build_object(
                'referenced_item_id', referenced_item_id,
                'soma_item_id', soma_item_id
              )
            )
            FROM estruturas_dre_soma_itens edsi
            WHERE edsi.soma_item_id = item_hierarchy.id
          )
          ELSE NULL
        END as soma_referencias_debug,
        CASE 
          WHEN tipo = 'SOMA' THEN (
            SELECT array_agg(referenced_item_id)
            FROM estruturas_dre_soma_itens edsi
            WHERE edsi.soma_item_id = item_hierarchy.id
          )
          ELSE NULL
        END as soma_referencias
      FROM item_hierarchy
      ORDER BY ordem ASC;
    `,
  });
}

export default loadEstruturaDreItensWithDebug;
