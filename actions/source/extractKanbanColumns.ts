import { action } from '@uibakery/data';

function extractKanbanColumns() {
  return action('extractKanbanColumns', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM kanban_columns
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractKanbanColumns;
