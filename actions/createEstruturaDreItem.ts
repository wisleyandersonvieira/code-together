import { action } from '@uibakery/data';

function createEstruturaDreItem() {
  return action('createEstruturaDreItem', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO estruturas_dre_itens (
        estrutura_dre_id,
        tipo,
        nome,
        grupo_contabil_id,
        subgrupo_contabil_id,
        ordem,
        nivel,
        parent_id
      ) VALUES (
        {{params.estruturaId}},
        '{{params.tipo}}',
        '{{params.nome}}',
        {{ params.grupoContabilId || 'NULL' }},
        {{ params.subgrupoContabilId || 'NULL' }},
        {{params.ordem}},
        {{params.nivel}},
        {{ params.parentId || 'NULL' }}
      )
      RETURNING *;
    `,
  });
}

export default createEstruturaDreItem;


