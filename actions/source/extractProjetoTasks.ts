import { action } from '@uibakery/data';

function extractProjetoTasks() {
  return action('extractProjetoTasks', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM projeto_tasks
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractProjetoTasks;
