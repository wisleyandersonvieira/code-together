import { action } from '@uibakery/data';

function configureSomaReferences() {
  return action('configureSomaReferences', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH lucro_config AS (
        INSERT INTO estruturas_dre_soma_itens (soma_item_id, referenced_item_id)
        SELECT 
          lucro.id as soma_item_id,
          grupo.id as referenced_item_id
        FROM estruturas_dre_itens lucro
        CROSS JOIN estruturas_dre_itens grupo
        WHERE lucro.estrutura_dre_id = {{params.estruturaId}}
          AND lucro.tipo = 'SOMA'
          AND lucro.nome = 'Lucro'
          AND grupo.estrutura_dre_id = {{params.estruturaId}}
          AND grupo.tipo IN ('GRUPO', 'APORTE')
          AND NOT EXISTS (
            SELECT 1 FROM estruturas_dre_soma_itens edsi 
            WHERE edsi.soma_item_id = lucro.id AND edsi.referenced_item_id = grupo.id
          )
        RETURNING soma_item_id, referenced_item_id
      ),
      saldo_config AS (
        INSERT INTO estruturas_dre_soma_itens (soma_item_id, referenced_item_id)
        SELECT 
          saldo.id as soma_item_id,
          item.id as referenced_item_id
        FROM estruturas_dre_itens saldo
        CROSS JOIN estruturas_dre_itens item
        WHERE saldo.estrutura_dre_id = {{params.estruturaId}}
          AND saldo.tipo = 'SOMA'
          AND saldo.nome = 'Saldo'
          AND item.estrutura_dre_id = {{params.estruturaId}}
          AND (
            (item.tipo = 'SOMA' AND item.nome = 'Lucro') OR
            (item.tipo = 'RETIRADA')
          )
          AND NOT EXISTS (
            SELECT 1 FROM estruturas_dre_soma_itens edsi 
            WHERE edsi.soma_item_id = saldo.id AND edsi.referenced_item_id = item.id
          )
        RETURNING soma_item_id, referenced_item_id
      )
      SELECT 'configured' as result;
    `,
  });
}

export default configureSomaReferences;
