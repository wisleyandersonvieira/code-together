import { action } from '@uibakery/data';

function debugSomaReferences() {
  return action('debugSomaReferences', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        edi.id as soma_item_id,
        edi.nome as soma_nome,
        edi.estrutura_dre_id,
        edsi.referenced_item_id,
        ref_edi.nome as referenced_nome,
        ref_edi.tipo as referenced_tipo
      FROM estruturas_dre_itens edi
      LEFT JOIN estruturas_dre_soma_itens edsi ON edi.id = edsi.soma_item_id
      LEFT JOIN estruturas_dre_itens ref_edi ON edsi.referenced_item_id = ref_edi.id
      WHERE edi.tipo = 'SOMA' AND edi.estrutura_dre_id = {{params.estruturaId}}
      ORDER BY edi.ordem, edsi.referenced_item_id;
    `,
  });
}

export default debugSomaReferences;
