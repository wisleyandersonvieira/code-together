import { action } from '@uibakery/data';

function updateKanbanColumn() {
  return action('updateKanbanColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE kanban_columns 
      SET name = {{params.name}}
      WHERE id = {{params.id}}
      RETURNING id, name, position, color;
    `,
  });
}

export default updateKanbanColumn;
