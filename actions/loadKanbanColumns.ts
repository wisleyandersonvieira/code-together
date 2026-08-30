import { action } from '@uibakery/data';

function loadKanbanColumns() {
  return action('loadKanbanColumns', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        kc.id,
        kc.name,
        kc.position,
        kc.color,
        kc.icon,
        COUNT(p.id) as projeto_count
      FROM kanban_columns kc
      LEFT JOIN projetos p ON kc.id = p.kanban_column_id
      GROUP BY kc.id, kc.name, kc.position, kc.color, kc.icon
      ORDER BY kc.position;
    `,
  });
}

export default loadKanbanColumns;
