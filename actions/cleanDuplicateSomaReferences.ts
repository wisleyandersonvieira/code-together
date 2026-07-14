import { action } from '@uibakery/data';

function cleanDuplicateSomaReferences() {
  return action('cleanDuplicateSomaReferences', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Statement único (CTE modificadora): a edge function execute-sql aceita
      -- apenas um comando por requisição.
      -- O SELECT final enxerga o snapshot anterior ao DELETE, por isso as linhas
      -- removidas são excluídas explicitamente via NOT IN (SELECT id FROM dedup).
      WITH dedup AS (
        DELETE FROM estruturas_dre_soma_itens
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM estruturas_dre_soma_itens
          GROUP BY soma_item_id, referenced_item_id
        )
        RETURNING id
      )
      SELECT
        soma_item_id,
        array_agg(referenced_item_id ORDER BY referenced_item_id) as referencias
      FROM estruturas_dre_soma_itens
      WHERE id NOT IN (SELECT id FROM dedup)
      GROUP BY soma_item_id
      ORDER BY soma_item_id;
    `,
  });
}

export default cleanDuplicateSomaReferences;
