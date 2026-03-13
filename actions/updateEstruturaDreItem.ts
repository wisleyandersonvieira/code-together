import { action } from '@uibakery/data';

function updateEstruturaDreItem() {
  return action('updateEstruturaDreItem', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE estruturas_dre_itens
      SET
        tipo = '{{params.tipo}}',
        nome = '{{params.nome}}',
        grupo_contabil_id = {{ params.grupoContabilId || 'NULL' }},
        subgrupo_contabil_id = {{ params.subgrupoContabilId || 'NULL' }},
        ordem = {{params.ordem}},
        nivel = {{params.nivel}},
        parent_id = {{ params.parentId || 'NULL' }},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING *;
    `,
  });
}

export default updateEstruturaDreItem;

