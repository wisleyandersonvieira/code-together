import { action } from '@uibakery/data';

function cleanDuplicateSomaReferences() {
  return action('cleanDuplicateSomaReferences', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Remove duplicate SOMA references
      DELETE FROM estruturas_dre_soma_itens 
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM estruturas_dre_soma_itens
        GROUP BY soma_item_id, referenced_item_id
      );
      
      -- Return the remaining references
      SELECT 
        soma_item_id,
        array_agg(referenced_item_id ORDER BY referenced_item_id) as referencias
      FROM estruturas_dre_soma_itens
      GROUP BY soma_item_id
      ORDER BY soma_item_id;
    `,
  });
}

export default cleanDuplicateSomaReferences;
