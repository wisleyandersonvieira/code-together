import { action } from '@uibakery/data';

function moveProjetoToColumn() {
  return action('moveProjetoToColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Statement único (CTE modificadora): a edge function execute-sql aceita
      -- apenas um comando por requisição. A CTE lê o snapshot anterior ao UPDATE,
      -- então kanban_column_id ainda é a coluna de origem no histórico.
      WITH historico AS (
        INSERT INTO projeto_column_history (projeto_id, user_id, from_column_id, to_column_id, moved_at)
        SELECT
          {{params.projetoId}},
          {{params.userId}},
          kanban_column_id,
          {{params.columnId}},
          CURRENT_TIMESTAMP
        FROM projetos
        WHERE id = {{params.projetoId}}
          AND {{params.columnId}} != COALESCE(kanban_column_id, 0)
      )
      UPDATE projetos
      SET
        kanban_column_id = {{params.columnId}},
        kanban_position = {{params.position}}
      WHERE id = {{params.projetoId}};
    `,
  });
}

export default moveProjetoToColumn;
