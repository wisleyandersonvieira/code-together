import { action } from '@uibakery/data';

function deleteKanbanColumn() {
  return action('deleteKanbanColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM kanban_columns 
      WHERE id = {{params.columnId}}
      AND id NOT IN (
        SELECT DISTINCT kanban_column_id 
        FROM projetos 
        WHERE kanban_column_id IS NOT NULL
      );
    `,
  });
}

export default deleteKanbanColumn;
