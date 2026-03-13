import { action } from '@uibakery/data';

function insertGrupoMemberSimple() {
  return action('insertGrupoMemberSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO grupo_members (id, grupo_id, cliente_id, empresa_id, percentage)
      VALUES (
        {{params.id}}, 
        {{params.grupo_id || 1}}, 
        {{params.cliente_id || 'NULL'}}, 
        {{params.empresa_id || 'NULL'}}, 
        {{params.percentage || 100}}
      )
      ON CONFLICT (id) DO UPDATE SET
        grupo_id = EXCLUDED.grupo_id,
        cliente_id = EXCLUDED.cliente_id,
        empresa_id = EXCLUDED.empresa_id,
        percentage = EXCLUDED.percentage;
    `,
  });
}

export default insertGrupoMemberSimple;
