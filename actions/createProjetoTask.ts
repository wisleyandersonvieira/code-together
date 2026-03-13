import { action } from '@uibakery/data';

function createProjetoTask() {
  return action('createProjetoTask', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO projeto_tasks (projeto_id, task_name, created_by)
      VALUES ({{params.projetoId}}, '{{params.taskName}}', {{params.userId}})
      RETURNING id, task_name, is_completed, created_at;
    `,
  });
}

export default createProjetoTask;
