import { action } from '@uibakery/data';

function insertProjetoColumnHistorySimple() {
  return action('insertProjetoColumnHistorySimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projeto_column_history (
        id, projeto_id, from_column_id, to_column_id, user_id, moved_at, created_at, updated_at
      ) VALUES (
        {{params.id}}, {{params.projeto_id}}, {{params.from_column_id}}, {{params.to_column_id}}, 
        {{params.user_id}}, {{params.moved_at}}, {{params.created_at}}, {{params.updated_at}}
      )
      ON CONFLICT (id) DO UPDATE SET
        projeto_id = EXCLUDED.projeto_id,
        from_column_id = EXCLUDED.from_column_id,
        to_column_id = EXCLUDED.to_column_id,
        user_id = EXCLUDED.user_id,
        moved_at = EXCLUDED.moved_at,
        updated_at = EXCLUDED.updated_at;
    `,
  });
}

export default insertProjetoColumnHistorySimple;
