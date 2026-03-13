import { action } from '@uibakery/data';

function createKanbanColumn() {
  return action('createKanbanColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO kanban_columns (name, position, color)
      VALUES (
        '{{params.name}}',
        COALESCE((SELECT MAX(position) FROM kanban_columns), 0) + 1,
        '{{params.color}}'
      )
      RETURNING id, name, position, color;
    `,
  });
}

export default createKanbanColumn;
