import { action } from '@uibakery/data';

function toggleProjetoTask() {
  return action('toggleProjetoTask', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE projeto_tasks 
      SET 
        is_completed = {{params.isCompleted}},
        completed_by = CASE 
          WHEN {{params.isCompleted}} = true THEN {{params.userId}} 
          ELSE NULL 
        END,
        completed_at = CASE 
          WHEN {{params.isCompleted}} = true THEN CURRENT_TIMESTAMP 
          ELSE NULL 
        END
      WHERE id = {{params.taskId}}
      RETURNING id, is_completed, completed_at;
    `,
  });
}

export default toggleProjetoTask;
