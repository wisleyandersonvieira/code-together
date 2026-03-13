import { action } from '@uibakery/data';

function insertProjetoMemberSimple() {
  return action('insertProjetoMemberSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projeto_members (
        id, projeto_id, cliente_id, empresa_id, grupo_id, percentage, created_at
      ) VALUES (
        {{params.id}}, {{params.projeto_id}}, {{params.cliente_id}}, 
        {{params.empresa_id}}, {{params.grupo_id}}, {{params.percentage}}, 
        COALESCE('{{params.created_at}}'::timestamp, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        projeto_id = EXCLUDED.projeto_id,
        cliente_id = EXCLUDED.cliente_id,
        empresa_id = EXCLUDED.empresa_id,
        grupo_id = EXCLUDED.grupo_id,
        percentage = EXCLUDED.percentage;
    `,
  });
}

export default insertProjetoMemberSimple;
