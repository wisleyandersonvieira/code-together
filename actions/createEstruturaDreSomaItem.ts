import { action } from '@uibakery/data';

function createEstruturaDreSomaItem() {
  return action('createEstruturaDreSomaItem', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO estruturas_dre_soma_itens (soma_item_id, referenced_item_id)
      VALUES ({{params.somaItemId}}, {{params.referencedItemId}});
    `,
  });
}

export default createEstruturaDreSomaItem;
