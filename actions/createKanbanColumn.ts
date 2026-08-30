import { action } from '@uibakery/data';

function createKanbanColumn() {
  return action('createKanbanColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO kanban_columns (name, position, color, icon)
      VALUES (
        '{{params.name}}',
        COALESCE((SELECT MAX(position) FROM kanban_columns), 0) + 1,
        '{{params.color}}',
        -- Sem ícone escolhido chega como string vazia ou nulo: os dois viram NULL.
        NULLIF('{{params.icon}}', '')
      )
      RETURNING id, name, position, color, icon;
    `,
  });
}

export default createKanbanColumn;
