import { action } from '@uibakery/data';

function loadProjetosByColumn() {
  return action('loadProjetosByColumn', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id,
        p.name,
        p.status,
        p.created_at,
        p.kanban_column_id,
        p.kanban_position,
        STRING_AGG(DISTINCT COALESCE(c.name, e.name, g.name), ', ') as client_name,
        COUNT(DISTINCT pt.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN pt.is_completed = true THEN pt.id END) as completed_tasks,
        COUNT(DISTINCT pc.id) as comment_count
      FROM projetos p
      LEFT JOIN projeto_members pm ON p.id = pm.projeto_id
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      LEFT JOIN projeto_tasks pt ON p.id = pt.projeto_id
      LEFT JOIN projeto_comments pc ON p.id = pc.projeto_id
      WHERE ({{params.columnId}} = 0 OR p.kanban_column_id = {{params.columnId}})
      GROUP BY p.id, p.name, p.status, p.created_at, p.kanban_column_id, p.kanban_position
      ORDER BY p.kanban_position, p.created_at DESC;
    `,
  });
}

export default loadProjetosByColumn;
