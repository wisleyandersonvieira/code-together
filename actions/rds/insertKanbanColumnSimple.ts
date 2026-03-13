import { action } from '@uibakery/data';

function insertKanbanColumnSimple() {
  return action('insertKanbanColumnSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO kanban_columns (id, name, position, color)
      VALUES ({{params.id}}, '{{params.name || "Coluna " + params.id}}', {{params.position || params.ordem || params.id}}, '{{params.color || "#3B82F6"}}')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        color = EXCLUDED.color,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertKanbanColumnSimple;
