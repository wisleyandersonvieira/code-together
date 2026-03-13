import { action } from '@uibakery/data';

function loadProjetoTasks() {
  return action('loadProjetoTasks', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pt.id,
        pt.task_name,
        pt.is_completed,
        pt.created_at,
        pt.completed_at,
        u1.name as created_by_name,
        u2.name as completed_by_name
      FROM projeto_tasks pt
      JOIN users u1 ON pt.created_by = u1.id
      LEFT JOIN users u2 ON pt.completed_by = u2.id
      WHERE pt.projeto_id = {{params.projetoId}}
      ORDER BY pt.created_at DESC;
    `,
  });
}

export default loadProjetoTasks;
